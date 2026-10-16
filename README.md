# AI-Based Industrial Maintenance and Process Optimization System

## Overview

This project is a web-based industrial maintenance platform designed to monitor machine data, display machine failure predictions, detect unusual sensor patterns, and support maintenance decisions.

The frontend provides an interactive interface for users to access machine information, view analytical results, and interact with the backend services.

## Features

- **Dashboard:** View an overview of machine status and system insights.
- **Machine Monitoring:** Display machine details and sensor readings.
- **Failure Prediction:** View machine failure risk predictions returned by the backend.
- **Anomaly Detection:** Display unusual machine sensor patterns.
- **Process Optimization:** Access optimization features available in the application.
- **AI Assistant:** Interact with maintenance knowledge assistance, if configured.
- **Authentication:** Login and registration functionality, if enabled.

## Technology Stack

- Next.js
- React
- TypeScript
- CSS
- FastAPI backend
- PostgreSQL database

## Getting Started

### Prerequisites

Install Node.js and npm before running the frontend.

### 1. Install Dependencies

Open a terminal in the frontend project directory and run:

```bash
npm install
```

### 2. Configure Environment Variables

If your application requires a backend URL, configure the appropriate environment variable in a `.env.local` file.

Example:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Use the environment variable name expected by your actual application code.

### 3. Run the Development Server

```bash
npm run dev
```

### 4. Open the Application

Visit:

http://localhost:3000

The frontend should now be available in your browser.

## Backend Integration

The frontend communicates with the Python FastAPI backend to access machine information, submit prediction requests, and retrieve results.

Make sure the backend and PostgreSQL database are configured and running when using features that depend on them.

## Project Structure

The application uses Next.js for its frontend. Depending on the implementation, the project may contain:

- `app/` — Pages and application routing.
- `components/` — Reusable UI components.
- `lib/` — API utilities and shared functions.
- `public/` — Static assets.

## Project Goal

The goal is to provide a single interface for industrial machine monitoring, failure risk analysis, anomaly detection, and maintenance support.

## Limitations

The machine learning system uses simulated data for initial experimentation. Predictions and anomaly alerts require further validation with real industrial data before operational use.
