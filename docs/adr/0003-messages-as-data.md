# ADR-0003: Export messages as embedded JSON, render with virtualization

* Status: Accepted · Date: 2026-11-17

## Context
The prototype pre-renders every message to HTML (~1 MB for 2k messages); 50k-message chats freeze phones.

## Decision
The exporter embeds the `ChatSession` as JSON; `<wa-message-list>` renders only visible rows.
