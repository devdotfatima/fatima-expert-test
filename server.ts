/// <reference lib="deno.ns" />
/// <reference lib="deno.unstable" />

import console from "node:console";
import { serve } from "std/http/server.ts";

serve(
  (req) =>
    new Response(JSON.stringify({ msg: "Hello from Deno!" }), {
      headers: { "Content-Type": "application/json" },
    }),
  { port: 8000 }
);

console.log("🚀 Server listening on http://localhost:8000");




