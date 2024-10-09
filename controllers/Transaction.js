const Transaction = require("../model/transactions");

// Function to list transactions with optional search, month filter, and pagination
const listTransactions = async (req) => {
  const { month, page = 1, perPage = 10, search = "" } = req.query;
  console.log(req.query);
  try {
    const pipeline = [];

    // Add $search stage if a search query is provided
    if (search) {
      const parsedSearch = parseFloat(search); // Parse search input once
      const isNumeric = !isNaN(parsedSearch) && isFinite(parsedSearch); // Check if the search input is a number
      if (isNumeric) {
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
      } else {
        const regexSearch = new RegExp(search, "i"); // Create a case-insensitive regex
        pipeline.push({
          $match: {
            $or: [
              {
                title: { $regex: regexSearch }, // Search in title
              },
              {
                description: { $regex: regexSearch }, // Search in description
              },
            ],
          },
        });
      }
    }

    // Add the $match stage for filtering by month if a month is provided
    if (month) {
      pipeline.push({
        $match: {
          $expr: {
            $eq: [{ $month: "$dateOfSale" }, parseInt(month)], // Compare the extracted month with the passed month
          },
        },
      });
    }

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
      // Use the aggregation pipeline when search or month filtering is applied
      transactions = await Transaction.aggregate(pipeline);
      // transactions =await Transaction.find
    } else {
      // Use regular find with pagination when no filters are applied
      transactions = await Transaction.find()
        .skip((parseInt(page) - 1) * parseInt(perPage))
        .limit(parseInt(perPage));
    }

    // Get the total count for the query (without pagination)
    const totalCount = await Transaction.countDocuments();

    // Return the final result
    return {
      totalCount,
      page,
      perPage,
      transactions,
    };
  } catch (error) {
    console.error("Error in listTransactions: ", error);
    return { error: "An error occurred while fetching transactions" };
  }
};

// Example usage of the function

const getStatistics = async (req) => {
  const { month } = req.query;
  try {
    if (!month) {
      return { error: "Month is required" };
    }

    const pipeline = [
      {
        $match: {
          $expr: {
            $eq: [{ $month: "$dateOfSale" }, parseInt(month)],
          },
        },
      },
      {
        $group: {
          _id: null,
          totalSaleAmount: {
            $sum: {
              $cond: [{ $eq: ["$sold", true] }, "$price", 0],
            },
          },
          totalSoldItems: {
            $sum: { $cond: [{ $eq: ["$sold", true] }, 1, 0] },
          },
          totalNotSoldItems: {
            $sum: { $cond: [{ $eq: ["$sold", false] }, 1, 0] },
          },
        },
      },
    ];

    const result = await Transaction.aggregate(pipeline);

    if (result.length === 0) {
      return { error: "No data found for the selected month" };
    }

    const statistics = result[0];
    return {
      totalSaleAmount: statistics.totalSaleAmount,
      totalSoldItems: statistics.totalSoldItems,
      totalNotSoldItems: statistics.totalNotSoldItems,
    };
  } catch (error) {
    console.error("Error in getStatistics:", error);
    return { error: "Server error" };
  }
};

const getBarChartData = async (req) => {
  const { month } = req.query;
  try {
    if (!month) {
      return { error: "Month is required" };
    }

    // Define the price ranges
    const priceRanges = [
      "0-100",
      "101-200",
      "201-300",
      "301-400",
      "401-500",
      "501-600",
      "601-700",
      "701-800",
      "801-900",
      "901-above",
    ];

    // Define the aggregation pipeline
    const pipeline = [
      {
        $match: {
          $expr: {
            $eq: [{ $month: "$dateOfSale" }, parseInt(month)],
          },
        },
      },
      {
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
              default: "901-above",
            },
          },
        },
      },
      {
        $group: {
          _id: "$priceRange",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ];

    // Execute the aggregation pipeline
    const result = await Transaction.aggregate(pipeline);

    // Convert the result to a map for easier access
    const resultMap = result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    // Create an array to hold the final counts for all price ranges
    const counts = priceRanges.map((range) => ({
      range: range,
      count: resultMap[range] || 0, // Default to 0 if no transactions
    }));

    return counts;
  } catch (error) {
    console.error("Error in getBarChartData:", error);
    return { error: "Server error" };
  }
};

const getPieChartData = async (req) => {
  const { month } = req.query;
  try {
    if (!month) {
      return { error: "Month is required" };
    }

    const pipeline = [
      {
        $match: {
          $expr: {
            $eq: [{ $month: "$dateOfSale" }, parseInt(month)],
          },
        },
      },
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { count: -1 },
      },
    ];

    const result = await Transaction.aggregate(pipeline);

    const pieChartData = result.map((item) => ({
      category: item._id,
      count: item.count,
    }));

    return pieChartData;
  } catch (error) {
    console.error("Error in getPieChartData:", error);
    return { error: "Server error" };
  }
};

module.exports = {
  listTransactions,
  getStatistics,
  getBarChartData,
  getPieChartData,
};
