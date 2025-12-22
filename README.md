# OpenMeet Platform

## The Free, Open-Source Alternative to Meetup

OpenMeet is a **free event platform** for community organizers. Think of it as Meetup without the fees—completely free for groups of any size.

**Live now:** [platform.openmeet.net](https://platform.openmeet.net)

### Why OpenMeet?

| Meetup | OpenMeet |
|--------|----------|
| $200+/year organizer fees | **Free forever** |
| Owns your data | **You own your data** |
| Proprietary platform | **Open source** — self-host or use ours |
| Centralized | **AT Protocol integration** — events sync to your data store |

### Who Uses OpenMeet?

| Use Case | Example |
|----------|---------|
| Local interest groups | Book clubs, running groups, photography meetups |
| Tech communities | Developer meetups, open source gatherings |
| AT Protocol enthusiasts | Events on the decentralized social web |
| Meetup refugees | Organizers tired of paying for basic features |

**Common pain points we solve:**
- Meetup's organizer fees are too expensive for small groups
- Don't want to be marketed at or have data sold
- Want to own your data, not be locked into a platform

---

## Features

### Events
- Create one-time or recurring events with date, time, location
- RSVP management with confirmed/waitlist status
- Capacity limits with automatic waitlisting
- Quick RSVP — guests can RSVP with just email, no account required
- Calendar invites sent automatically

### Groups
- Create communities around shared interests
- Group membership management
- Public or unlisted visibility
- Group chat via Matrix integration

### Communication
- Real-time chat rooms for groups and events
- Direct messages to organizers
- Email outreach to members and attendees
- Notification controls

### Authentication
- Email/password or passwordless login (6-digit codes)
- OAuth: Google, GitHub
- **AT Protocol** — sign in with your Bluesky or other AT Protocol account

### AT Protocol Integration
- Sign in with your Bluesky or other AT Protocol account
- Events and RSVPs sync to your Personal Data Server (PDS)
- Activity visible on the decentralized social web
- Export your data anytime

### Coming Soon
- **Private groups and events** — invite-only communities (in development)
- **Waitlist promotion** — automatic spot offers when someone cancels
- **Guest +1** — bring friends to events

---

## Tech Stack

OpenMeet Platform is the frontend web application, built with:

- **[Vue 3](https://vuejs.org/)** + **[Quasar Framework](https://quasar.dev/)** — Responsive Material Design UI
- **[Pinia](https://pinia.vuejs.org/)** — State management
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety
- **[Vitest](https://vitest.dev/)** — Unit testing
- **[Cypress](https://www.cypress.io/)** — E2E and component testing

### Related Repositories

| Repository | Description | Stack |
|------------|-------------|-------|
| [openmeet-api](https://github.com/OpenMeet-Team/openmeet-api) | Backend API | NestJS, TypeScript, PostgreSQL |
| [openmeet-platform](https://github.com/OpenMeet-Team/openmeet-platform) | Frontend (this repo) | Vue 3, Quasar, TypeScript |
| [survey](https://github.com/OpenMeet-Team/survey) | Survey/polling service | Go, Templ, HTMX |

---

## Getting Started

### Prerequisites
- Node.js (v22)
- npm (>= 6.13.4)

### Install Dependencies
```bash
npm install
```

### Configuration

Copy environment files:
```bash
cp .env.example .env
cp public/config.example.json public/config.json
```

Key configuration in `public/config.json`:
- `APP_API_URL`: Backend API URL
- `APP_TENANT_ID`: Your tenant identifier
- `APP_TENANT_NAME`: Your organization/community name

### Development
```bash
npm run dev
```

### Testing
```bash
# Unit tests
npm run test:unit:ci
```

> **Note:** Cypress E2E tests are currently out of date and will mostly fail. We're working on updating them. Unit tests are reliable.

### Build for Production
```bash
npm run build
```

### Docker
```bash
docker build -t openmeet-platform .
docker run -p 80:80 openmeet-platform
```

---

## Project Structure

```
src/
├── pages/           # Route pages
├── components/      # Reusable UI components
├── stores/          # Pinia state stores
├── composables/     # Vue composition utilities
├── api/             # API client functions
├── types/           # TypeScript interfaces
├── router/          # Vue Router configuration
├── boot/            # Quasar boot files (plugins)
└── utils/           # Helper functions
```

---

## Contributing

We welcome contributions! Here's how to get started:

1. Check out our [good first issues](https://github.com/OpenMeet-Team/openmeet-platform/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22)
2. Fork the repo and create a feature branch
3. Submit a PR — we review within a few days

See [CONTRIBUTORS.md](CONTRIBUTORS.md) for the people who have helped build OpenMeet.

### Community

- **Discord:** [discord.gg/eQcYADgnrc](https://discord.gg/eQcYADgnrc)
- **Bluesky:** [@openmeet.net](https://bsky.app/profile/openmeet.net)

### Support OpenMeet

OpenMeet is free for community groups, funded by the community. Help cover hosting costs (~$350/month) at [platform.openmeet.net/support](https://platform.openmeet.net/support).
