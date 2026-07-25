package services

import "errors"

// ErrNotFound is returned by services when a requested resource does not exist.
var ErrNotFound = errors.New("not found")

// IsNotFound reports whether err is (or wraps) ErrNotFound.
// Handlers use this to distinguish 404 from 500 responses.
func IsNotFound(err error) bool {
	return errors.Is(err, ErrNotFound)
}
