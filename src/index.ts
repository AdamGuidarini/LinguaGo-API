import express, { Request, Response } from 'express';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json());

app.get('/', (req: Request, res: Response) => {
  res.send('Hello, world!');
});

app.get('/api/hello', (req: Request, res: Response) => {
  res.json({ message: 'Hello from Express!' });
});

app.post('/api/echo', (req: Request, res: Response) => {
  res.json({ you_sent: req.body });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
