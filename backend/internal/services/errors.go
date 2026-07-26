package services

import "errors"

// ErrNotFound is returned by services when a requested resource does not exist.
// The canonical IsNotFound (in stock_quote.go) matches on the error text, so
// returning ErrNotFound (whose message is "not found") is detected as a 404.
var ErrNotFound = errors.New("not found")
