import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { checkItemPrice } from './priceLogic.js';

dotenv.config();

const app = express();
app.use(cors());

app.get('/checkPrice', async (req, res) => {
  const item = req.query.item;
  if (!item) return res.status(400).json({ error: 'Missing item parameter' });

  try {
    const data = await checkItemPrice(item);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Server error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server listening on port ${PORT}`));
