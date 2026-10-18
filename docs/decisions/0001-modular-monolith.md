# 0001 – Modular monolith in one Next.js app

**Status:** accepted

Single deployable Next.js app with feature modules (`domain` / `application` / `infrastructure` / `schemas`).

**Why:** hackathon speed and simplicity; no network boundaries to debug.

**Tradeoff:** boundaries are enforced by convention only. Modules talk through exported types and
services, so they can be extracted later. No Redis/Kafka/queues until a concrete need appears.
