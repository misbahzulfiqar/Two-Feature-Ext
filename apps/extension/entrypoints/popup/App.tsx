import { SellSimilarApiClient } from "@sell-similar/api-client";
import { useState } from "react";

const api = new SellSimilarApiClient({
  baseUrl: import.meta.env.WXT_API_BASE_URL ?? "http://localhost:3001",
});

export default function App() {
  const [status, setStatus] = useState("Idle");

  async function checkApi(): Promise<void> {
    setStatus("Checking API…");
    try {
      const health = await api.health();
      setStatus(health.ok ? `API ready (${health.service})` : "API unavailable");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "API request failed");
    }
  }

  return (
    <main className="popup">
      <h1>Sell Similar</h1>
      <p>Find comparable eBay listings from the current item.</p>
      <button type="button" onClick={() => void checkApi()}>
        Check API
      </button>
      <p className="status">{status}</p>
    </main>
  );
}
