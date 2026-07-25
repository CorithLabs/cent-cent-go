package db

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Connect creates and validates a PostgreSQL connection pool.
// Returns an error if the database is unreachable.
func Connect(databaseURL string) (*pgxpool.Pool, error) {
	config, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid DATABASE_URL: %w", err)
	}

	config.MaxConns = 20
	config.MinConns = 2

	pool, err := pgxpool.NewWithConfig(context.Background(), config)
	if err != nil {
		return nil, fmt.Errorf("could not create connection pool: %w", err)
	}

	// Verify connectivity
	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("database ping failed: %w", err)
	}

	return pool, nil
}
