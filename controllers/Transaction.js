const Transaction = require("../model/transactions");

const listTransactions = async (req, res) => {
  const { month, page = 1, perPage = 10, search = "" } = req.query;

  const pipeline = [];
  if (search) {
    pipeline.push({
      $search: {
        index: "searching",
        compound: {
          should: [
            {
              text: {
                query: search,
                path: ["title", "description"],
              },
            },
            {
              equals: {
                path: "price",
                value: parseFloat(search),
              },
            },
          ],
        },
      },
    });
  }

  // Add the $match stage for filtering by month
  pipeline.push({
    $match: {
      $expr: {
        $eq: [{ $month: "$dateOfSale" }, parseInt(month)], // Compare the extracted month with the passed month
      },
    },
  });

  // Add pagination stages
  pipeline.push(
    {
      $skip: (parseInt(page) - 1) * parseInt(perPage),
    },
    {
      $limit: parseInt(perPage),
    }
  );

  let transactions;
  if (search || month) {
    // When search is provided, use the aggregation pipeline
    transactions = await Transaction.aggregate(pipeline);
  } else {
    // When no search is provided, use regular find with pagination
    transactions = await Transaction.find()
      .skip((parseInt(page) - 1) * parseInt(perPage))
      .limit(parseInt(perPage));
  }

  console.log(transactions);
  const totalCount = 10;

  res.status(200).json({
    totalCount,
    page,
    perPage,
    transactions,
  });
};

const getStatistics = async (req, res) => {
  try {
    const { month } = req.query; // Assume month is passed as a number (e.g., "11" for November)

    if (!month) {
      return res.status(400).json({ message: "Month is required" });
    }

    const pipeline = [
      {
        // Filter by month
        $match: {
          $expr: {
            $eq: [{ $month: "$dateOfSale" }, parseInt(month)], // Extract month from `dateOfSale`
          },
        },
      },
      {
        // Group stage to calculate totals
        $group: {
          _id: null, // We don't need to group by any specific field
          totalSaleAmount: {
            $sum: {
              $cond: [{ $eq: ["$sold", true] }, "$price", 0], // Sum only the sold items' prices
            },
          },
          totalSoldItems: {
            $sum: { $cond: [{ $eq: ["$sold", true] }, 1, 0] }, // Count only sold items
          },
          totalNotSoldItems: {
            $sum: { $cond: [{ $eq: ["$sold", false] }, 1, 0] }, // Count only unsold items
          },
        },
      },
    ];

    // Execute the aggregation pipeline
    const result = await Transaction.aggregate(pipeline);
    console.log(result);
    if (result.length === 0) {
      return res
        .status(404)
        .json({ message: "No data found for the selected month" });
    }

    const statistics = result[0];

    // Return the result
    return res.json({
      totalSaleAmount: statistics.totalSaleAmount,
      totalSoldItems: statistics.totalSoldItems,
      totalNotSoldItems: statistics.totalNotSoldItems,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const getBarChartData = async (req, res) => {
  try {
    const { month } = req.query; // Assume month is passed as a number (e.g., "11" for November)

    if (!month) {
      return res.status(400).json({ message: "Month is required" });
    }

    const pipeline = [
      {
        // First stage to filter by month
        $match: {
          $expr: {
            $eq: [{ $month: "$dateOfSale" }, parseInt(month)], // Compare the extracted month with the passed month
          },
        },
      },
      {
        // Add a price range field
        $addFields: {
          priceRange: {
            $switch: {
              branches: [
                { case: { $lte: ["$price", 100] }, then: "0-100" },
                {
                  case: {
                    $and: [{ $gt: ["$price", 100] }, { $lte: ["$price", 200] }],
                  },
                  then: "101-200",
                },
                {
                  case: {
                    $and: [{ $gt: ["$price", 200] }, { $lte: ["$price", 300] }],
                  },
                  then: "201-300",
                },
                {
                  case: {
                    $and: [{ $gt: ["$price", 300] }, { $lte: ["$price", 400] }],
                  },
                  then: "301-400",
                },
                {
                  case: {
                    $and: [{ $gt: ["$price", 400] }, { $lte: ["$price", 500] }],
                  },
                  then: "401-500",
                },
                {
                  case: {
                    $and: [{ $gt: ["$price", 500] }, { $lte: ["$price", 600] }],
                  },
                  then: "501-600",
                },
                {
                  case: {
                    $and: [{ $gt: ["$price", 600] }, { $lte: ["$price", 700] }],
                  },
                  then: "601-700",
                },
                {
                  case: {
                    $and: [{ $gt: ["$price", 700] }, { $lte: ["$price", 800] }],
                  },
                  then: "701-800",
                },
                {
                  case: {
                    $and: [{ $gt: ["$price", 800] }, { $lte: ["$price", 900] }],
                  },
                  then: "801-900",
                },
              ],
              default: "901-above", // Any price above 900
            },
          },
        },
      },
      {
        // Group by price range and count items
        $group: {
          _id: "$priceRange",
          count: { $sum: 1 }, // Count the number of items in each price range
        },
      },
      {
        // Sort the results by price range order
        $sort: { _id: 1 },
      },
    ];

    // Execute the aggregation pipeline
    const result = await Transaction.aggregate(pipeline);

    // Prepare the response for bar chart
    const counts= result.map((item) => ({ range: item._id, count: item.count }))
  

    // Return the result
    return res.json(counts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

const getPieChartData = async (req, res) => {
  try {
    const { month } = req.query;

    if (!month) {
      return res.status(400).json({ message: 'Month is required' });
    }

    const pipeline = [
      {
        // First stage to filter by month
        $match: {
          $expr: {
            $eq: [{ $month: "$dateOfSale" }, parseInt(month)], // Compare the extracted month with the passed month
          },
        },
      },
      {
        // Group by category and count the number of items in each category
        $group: {
          _id: "$category", // Group by category
          count: { $sum: 1 }, // Count the number of items in each category
        },
      },
      {
        // Sort categories by count (optional)
        $sort: { count: -1 },
      },
    ];

    // Execute the aggregation pipeline
    const result = await Transaction.aggregate(pipeline);

    // Prepare the response for the pie chart
    const pieChartData = {
      categories: result.map(item => ({
        category: item._id,
        count: item.count,
      })),
    };

    // Return the result
    return res.json(pieChartData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
}
module.exports = { listTransactions, getStatistics,getBarChartData,getPieChartData };
