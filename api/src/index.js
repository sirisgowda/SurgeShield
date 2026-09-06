import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import opsRouter from './routes/ops.js';
// import chaosRouter additions from A and invariants from B onto the same
// router before merging — see the note at the top of routes/ops.js.

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/ops', opsRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: err.message });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`api listening on :${port}`));
