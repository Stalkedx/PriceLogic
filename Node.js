import express from 'express';
import cors from 'cors';
import { checkItemPrice } from './Gt.js'; // your existing code file

const app = express();
app.use(cors());

app.get('/checkPrice', async (req, res) => {
  const itemName = req.query.item;
  if (!itemName) return res.status(400).json({ error: "Missing item name" });

  try {
    const priceData = await checkItemPrice(itemName);
    res.json(priceData);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
