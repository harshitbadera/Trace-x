import { app } from './app';
const port = Number(process.env.PORT || 8000);
app.listen(port, '127.0.0.1', () =>
  console.log(`Trace-X API ready at http://127.0.0.1:${port} (local-only)`),
);
