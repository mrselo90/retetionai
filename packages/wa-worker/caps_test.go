package main

import (
	"testing"
	"time"
)

func TestDailyCapWarmsUp(t *testing.T) {
	now := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	day := func(n int) *time.Time { t := now.Add(-time.Duration(n) * 24 * time.Hour); return &t }
	cases := []struct {
		name  string
		first *time.Time
		want  int
	}{
		{"never paired counts as day zero", nil, 40},
		{"first day", day(0), 40},
		{"day three", day(3), 80},
		{"second week", day(8), 150},
		{"settled line", day(40), 300},
	}
	for _, c := range cases {
		if got := dailyCap(c.first, now); got != c.want {
			t.Errorf("%s: got %d, want %d", c.name, got, c.want)
		}
	}
}

func TestReplyWindow(t *testing.T) {
	noteInbound("m1", "905551112233", "", "123456789012345")
	if !isReply("m1", "905551112233") || !isReply("m1", "123456789012345") {
		t.Fatal("a chat that just wrote should count as a reply, by phone or LID")
	}
	if isReply("m2", "905551112233") {
		t.Fatal("replies are per merchant")
	}
	if isReply("m1", "") {
		t.Fatal("an empty id must never match")
	}
}

func TestUntilUTCMidnight(t *testing.T) {
	now := time.Date(2026, 9, 25, 23, 0, 0, 0, time.UTC)
	if got := untilUTCMidnight(now); got != time.Hour {
		t.Fatalf("got %v", got)
	}
}
