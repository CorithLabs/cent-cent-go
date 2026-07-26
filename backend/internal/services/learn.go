package services

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/yuin/goldmark"
	meta "github.com/yuin/goldmark-meta"
	"github.com/yuin/goldmark/parser"
)

// ── Article types ──────────────────────────────────────────────────────────────

// LearnSection is a progressive depth section within an article.
type LearnSection struct {
	Heading    string `json:"heading"`
	Body       string `json:"body"`
	DiagramURL string `json:"diagramUrl,omitempty"`
}

// LearnArticle is the full article returned by GET /api/learn/:slug.
type LearnArticle struct {
	Slug         string         `json:"slug"`
	Title        string         `json:"title"`
	Summary      string         `json:"summary"`
	Sections     []LearnSection `json:"sections"`
	RelatedSlugs []string       `json:"relatedSlugs"`
	Tags         []string       `json:"tags"`
	ReadTime     string         `json:"readTime"`
}

// LearnArticleCard is the list item returned by GET /api/learn.
type LearnArticleCard struct {
	Slug     string   `json:"slug"`
	Title    string   `json:"title"`
	Summary  string   `json:"summary"`
	Tags     []string `json:"tags"`
	ReadTime string   `json:"readTime"`
}

// LearnListResponse is the shape for GET /api/learn.
type LearnListResponse struct {
	Articles []LearnArticleCard `json:"articles"`
}

// ── Service ────────────────────────────────────────────────────────────────────

// LearnService parses markdown concept articles at startup and serves them from
// an in-memory cache.
//
// AC: Articles are parsed at server startup — no file reads at request time.
// AC: Malformed frontmatter → log warning and skip file — do NOT crash.
// AC: Returns ErrNotFound for unknown slugs.
type LearnService struct {
	mu       sync.RWMutex
	articles map[string]*LearnArticle // slug → article
	cards    []LearnArticleCard
}

// NewLearnService creates and loads a LearnService from the given content directory.
// articlesDir should be the path to /content/learn relative to the working directory.
func NewLearnService(articlesDir string) *LearnService {
	svc := &LearnService{
		articles: make(map[string]*LearnArticle),
	}
	svc.loadAll(articlesDir)
	return svc
}

// ListArticles returns all article cards.
func (s *LearnService) ListArticles() *LearnListResponse {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return &LearnListResponse{Articles: s.cards}
}

// GetArticle returns a full article by slug.
// Returns ErrNotFound if the slug is unknown.
func (s *LearnService) GetArticle(slug string) (*LearnArticle, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	article, ok := s.articles[slug]
	if !ok {
		return nil, ErrNotFound
	}
	return article, nil
}

// ── Parsing ────────────────────────────────────────────────────────────────────

// loadAll reads and parses all *.md files in the given directory.
// AC: Malformed frontmatter: logs a warning and skips the file.
func (s *LearnService) loadAll(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Printf("[learn] content directory %q not found or unreadable: %v", dir, err)
		return
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".md") {
			continue
		}

		slug := strings.TrimSuffix(entry.Name(), ".md")
		filePath := filepath.Join(dir, entry.Name())

		article, err := parseMarkdownFile(filePath, slug)
		if err != nil {
			log.Printf("[learn] warning: skipping %s — %v", entry.Name(), err)
			continue
		}

		s.articles[slug] = article
		s.cards = append(s.cards, LearnArticleCard{
			Slug:     article.Slug,
			Title:    article.Title,
			Summary:  article.Summary,
			Tags:     article.Tags,
			ReadTime: article.ReadTime,
		})
	}

	log.Printf("[learn] loaded %d concept articles from %s", len(s.articles), dir)
}

// parseMarkdownFile reads and parses a single .md file using goldmark + goldmark-meta.
// AC: Uses goldmark for markdown body and goldmark-meta for YAML frontmatter.
func parseMarkdownFile(filePath, slug string) (*LearnArticle, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	// Set up goldmark with meta extension
	md := goldmark.New(
		goldmark.WithExtensions(
			meta.Meta,
		),
	)

	var buf bytes.Buffer
	ctx := parser.NewContext()

	if err := md.Convert(data, &buf, parser.WithContext(ctx)); err != nil {
		return nil, fmt.Errorf("parse markdown: %w", err)
	}

	// Extract YAML frontmatter from parser context
	metaData := meta.Get(ctx)
	if metaData == nil {
		return nil, fmt.Errorf("no frontmatter found in %s", filePath)
	}

	// Extract required frontmatter fields
	title, err := extractString(metaData, "title")
	if err != nil {
		return nil, fmt.Errorf("frontmatter 'title': %w", err)
	}

	summary, _ := extractString(metaData, "summary")
	readTime, _ := extractString(metaData, "readTime")
	tags := extractStringSlice(metaData, "tags")
	relatedSlugs := extractStringSlice(metaData, "relatedSlugs")

	// Parse sections from rendered HTML (split by <h2> headings)
	sections := parseSectionsFromHTML(buf.String())

	return &LearnArticle{
		Slug:         slug,
		Title:        title,
		Summary:      summary,
		Tags:         tags,
		ReadTime:     readTime,
		RelatedSlugs: relatedSlugs,
		Sections:     sections,
	}, nil
}

// parseSectionsFromHTML splits rendered HTML into progressive depth sections by <h2> tags.
func parseSectionsFromHTML(html string) []LearnSection {
	var sections []LearnSection

	parts := strings.Split(html, "<h2>")
	for i, part := range parts {
		if i == 0 {
			continue // skip content before first h2
		}

		closingIdx := strings.Index(part, "</h2>")
		if closingIdx < 0 {
			continue
		}
		heading := strings.TrimSpace(part[:closingIdx])
		body := strings.TrimSpace(part[closingIdx+5:])

		heading = stripHTMLTags(heading)

		sections = append(sections, LearnSection{
			Heading: heading,
			Body:    body,
		})
	}

	return sections
}

// ── Frontmatter helpers ────────────────────────────────────────────────────────

func extractString(metaMap map[string]interface{}, key string) (string, error) {
	v, ok := metaMap[key]
	if !ok {
		return "", fmt.Errorf("missing key %q", key)
	}
	s, ok := v.(string)
	if !ok {
		return fmt.Sprintf("%v", v), nil
	}
	return s, nil
}

func extractStringSlice(metaData map[string]interface{}, key string) []string {
	v, ok := metaData[key]
	if !ok {
		return nil
	}
	switch val := v.(type) {
	case []interface{}:
		var result []string
		for _, item := range val {
			if s, ok := item.(string); ok {
				result = append(result, s)
			}
		}
		return result
	case []string:
		return val
	default:
		return nil
	}
}

// stripHTMLTags removes HTML tags from a string.
func stripHTMLTags(s string) string {
	var result strings.Builder
	inTag := false
	for _, r := range s {
		switch {
		case r == '<':
			inTag = true
		case r == '>':
			inTag = false
		case !inTag:
			result.WriteRune(r)
		}
	}
	return result.String()
}
