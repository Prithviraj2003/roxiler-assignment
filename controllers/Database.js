const axios = require("axios");
const Transaction = require("../model/transactions");

const initializeDatabase = async (req, res) => {
  try {
    const response = await axios.get(
      "https://s3.amazonaws.com/roxiler.com/product_transaction.json"
    );
    console.log(response);
    // Validate the response and log data if needed
    if (!response.data || !Array.isArray(response.data)) {
      return res.status(400).json({ message: "Invalid data format from API" });
    }

    const transactions = response.data.map((item) => {
      return {
        title: item.title, // Title field
        description: item.description, // Description field
        price: item.price,
        category: item.category,
        image: item.image,
        sold: item.sold, // Capturing the sold status
        dateOfSale: new Date(item.dateOfSale).toISOString().slice(0, 10), // Convert to YYYY-MM-DD format
      };
    });

    await Transaction.deleteMany(); // Clear existing data
    await Transaction.insertMany(transactions);
    res.status(200).json({
      message: "Database initialized successfully!",
      count: transactions.length,
    });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  initializeDatabase,
};
