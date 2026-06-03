import { createApp } from "./app.js";
import { env } from "./config/env.js";

const app = createApp();

app.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`▸ FlowCap server listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
});
