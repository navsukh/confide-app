# Confide

> AI-powered anonymous emotional support platform connecting people who need someone to talk to with verified listeners through intelligent real-time matching.

## Overview

Confide is a secure, anonymous mental wellness platform designed to help people connect through meaningful conversations.

Users can join as either:

- 🎤 Speaker — someone seeking emotional support
- 🤝 Listener — someone willing to help

The platform intelligently matches users based on preferences, language, gender, and availability while maintaining complete privacy.

---

# Features

## Authentication

- Phone Number Authentication
- OTP Verification
- JWT Authentication
- Secure Session Management

---

## Smart Matching

- Real-time listener matching
- Speaker / Listener roles
- Topic based matching
- Language preference
- Gender preference
- Queue management
- Automatic timeout handling

---

## Anonymous Chat

- One-to-one conversations
- WebSocket powered messaging
- Anonymous identities
- Real-time communication

---

## AI Safety

- OpenAI Moderation API
- Harmful content detection
- Crisis message routing
- Safety escalation
- Report & Block system

---

## Subscription System

Powered by Stripe.

Available Plans

- Silver
- Gold
- Diamond
- Platinum

Features include

- Secure Stripe Checkout
- Subscription Management
- Webhook Processing
- Premium Match Prioritization

---

## Listener System

- Experience Levels
- Points System
- Session Tracking
- Rating System
- Priority Matching

---

## Wellness Features

- Mood Tracking
- Personal Journal
- Free Trial System

---

## Push Notifications

- Expo Push Notifications
- Match Updates
- Subscription Updates

---

## Admin Dashboard

- Reports
- User Monitoring
- Subscription Management
- Safety Logs

---

# Tech Stack

## Mobile

- React Native
- Expo
- TypeScript

## Backend

- Fastify
- Node.js
- TypeScript

## Database

- PostgreSQL
- Prisma ORM

## Queue

- Redis
- BullMQ

## Authentication

- JWT
- OTP Verification

## Payments

- Stripe

## AI

- OpenAI Moderation API

## Real-Time

- Fastify WebSockets

## Monitoring

- Sentry

---

# Project Structure

```
confide-app
│
├── confide-backend
│   ├── prisma
│   ├── src
│   ├── Dockerfile
│   └── package.json
│
├── confide-mobile
│   ├── assets
│   ├── src
│   ├── app.json
│   └── package.json
│
└── README.md
```

---

# Backend Features

- REST API
- JWT Authentication
- WebSocket Chat
- AI Moderation
- Stripe Billing
- Redis Queue
- Match Worker
- Push Notifications
- Admin APIs

---

# Mobile Features

- Beautiful React Native UI
- OTP Login
- Subscription Flow
- Match Screen
- Anonymous Chat
- Mood Tracker
- Journal
- Profile Management

---

# Local Development

## Backend

```bash
cd confide-backend

npm install

npm run dev
```

---

## Mobile

```bash
cd confide-mobile

npm install

npx expo start
```

---

# Environment Variables

Backend requires:

```
DATABASE_URL
REDIS_URL

JWT_SECRET

OPENAI_API_KEY

STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET

STRIPE_PRICE_SILVER
STRIPE_PRICE_GOLD
STRIPE_PRICE_DIAMOND
STRIPE_PRICE_PLATINUM

EXPO_ACCESS_TOKEN

SENTRY_DSN
```

---

# Architecture

```
React Native App
        │
        ▼
 Fastify Backend
        │
 ├───────────────┐
 │               │
 ▼               ▼
PostgreSQL     Redis
 │               │
 ▼               ▼
 Prisma       BullMQ
 │
 ▼
Stripe
 │
 ▼
OpenAI Moderation
```

---

# Security

- JWT Authentication
- Anonymous User Identities
- Encrypted Sensitive Data
- Stripe Secure Payments
- AI Content Moderation
- Webhook Signature Verification

---

# Future Roadmap

- Voice Calling
- AI Emotional Insights
- Video Sessions
- Therapist Marketplace
- Community Support Groups
- Wearable Device Integration
- Analytics Dashboard
- Multi-language Support

---

# Status

🚧 Active Development

Confide is currently under active development with ongoing improvements to user experience, matching intelligence, AI safety, and premium subscription features.

---

# License

This project is licensed under the MIT License.

---

## Author

**Sukhraj Singh**

Built with ❤️ to make emotional support more accessible through technology.
