const express = require('express');
const path = require('path');

const app = express();

// Serve static files from the public directory
app.use(express.static('public'));

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
