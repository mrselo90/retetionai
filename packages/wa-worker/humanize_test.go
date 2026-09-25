package main

import (
	"testing"
	"time"
)

func TestTypingBase(t *testing.T) {
	cases := []struct {
		name  string
		runes int
		want  time.Duration
	}{
		{"kisa mesaj tabana yuvarlanir", 1, 1200 * time.Millisecond},
		{"bos mesaj da taban alir", 0, 1200 * time.Millisecond},
		{"orta uzunluk orantili", 100, 3800 * time.Millisecond},
		{"uzun mesaj tavanda kesilir", 1000, 6000 * time.Millisecond},
	}
	for _, c := range cases {
		if got := typingBase(c.runes); got != c.want {
			t.Errorf("%s: typingBase(%d) = %v, beklenen %v", c.name, c.runes, got, c.want)
		}
	}
}

func TestTypingDurationStaysInBounds(t *testing.T) {
	// Jitter must never push the wait below a second (two messages in the same
	// second is the thing being avoided) nor past the ceiling by much.
	for i := 0; i < 2000; i++ {
		d := typingDuration(i % 400)
		if d < time.Second {
			t.Fatalf("typingDuration(%d) = %v — bir saniyenin altina indi", i%400, d)
		}
		if d > 7*time.Second {
			t.Fatalf("typingDuration(%d) = %v — tavani asti", i%400, d)
		}
	}
}

func TestTypingDurationVaries(t *testing.T) {
	seen := map[time.Duration]bool{}
	for i := 0; i < 50; i++ {
		seen[typingDuration(100)] = true
	}
	if len(seen) < 2 {
		t.Fatal("her cagri ayni sureyi verdi — sabit aralik da bir desendir")
	}
}
