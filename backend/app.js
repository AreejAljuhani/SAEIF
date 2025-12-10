const express = require('express');
const bodyParser = require('body-parser');
const classifyRoute = require('./routes/classify');

const app = express();
app.use(bodyParser.json());
app.use('/api', classifyRoute);

app.listen(3000, () => console.log('Server running on http://localhost:3000'));
