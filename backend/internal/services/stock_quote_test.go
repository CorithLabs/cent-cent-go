package services

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestIsNotFound_TrueForNotFoundError(t *testing.T) {
	err := fmt.Errorf("ticker XXXX not found in reference data")
	assert.True(t, IsNotFound(err))
}

func TestIsNotFound_FalseForOtherErrors(t *testing.T) {
	err := fmt.Errorf("polygon returned 500")
	assert.False(t, IsNotFound(err))
}

func TestIsNotFound_FalseForNil(t *testing.T) {
	assert.False(t, IsNotFound(nil))
}
