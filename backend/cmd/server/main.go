package main

import (
	"log"
	"os"

	"github.com/CorithLabs/cent-cent-go/api"
	"github.com/CorithLabs/cent-cent-go/internal/db"
	"github.com/joho/godotenv"
)

func main() {
	// Load .env for local development. In production this is a no-op
	// because env vars are injected by the runtime.
	if err := godotenv.Load("../../.env"); err != nil {
		log.Println("[WARNING] .env file not found — relying on environment variables")
	}

	// Validate required env vars and exit with a clear message if missing
	required := []string{"POLYGON_API_KEY", "FRED_API_KEY", "DATABASE_URL"}
	missing := []string{}
	for _, key := range required {
		if os.Getenv(key) == "" {
			missing = append(missing, key)
		}
	}
	if len(missing) > 0 {
		log.Fatalf("[FATAL] Missing required environment variables: %v\n"+
			"Copy .env.example to .env and set your keys.", missing)
	}

	// Connect to PostgreSQL
	pool, err := db.Connect(os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("[FATAL] Could not connect to database: %v", err)
	}
	defer pool.Close()

	// Build and run the Gin router
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	router := api.NewRouter(pool)

	log.Printf("[INFO] Server listening on :%s", port)
	if err := router.Run(":" + port); err != nil {
		log.Fatalf("[FATAL] Server exited: %v", err)
	}
}
