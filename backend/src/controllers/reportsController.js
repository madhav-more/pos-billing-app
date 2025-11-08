import Transaction from '../models/Transaction.js';
import User from '../models/User.js';

export const getSalesReport = async (req, res) => {
  const { from, to, customer_id, payment_type } = req.query;
  const userId = req.user.userId;

  try {
    const query = { user_id: userId, status: 'completed' };

    if (from) query.date = { $gte: new Date(from) };
    if (to) query.date = { ...query.date, $lte: new Date(to) };
    if (customer_id) query.customer_id = customer_id;
    if (payment_type) query.payment_type = payment_type;

    const transactions = await Transaction.find(query)
      .populate('customer_id', 'name phone email address')
      .sort({ date: -1 });

    const user = await User.findById(userId);

    // Calculate summary stats
    const summary = {
      total_transactions: transactions.length,
      total_revenue: transactions.reduce((sum, tx) => sum + (tx.grand_total || 0), 0),
      total_items_sold: transactions.reduce((sum, tx) => sum + (tx.item_count || 0), 0),
      total_discount_given: transactions.reduce((sum, tx) => sum + (tx.discount || 0), 0),
      payment_type_breakdown: {}
    };

    // Group by payment type
    transactions.forEach(tx => {
      const type = tx.payment_type || 'unknown';
      if (!summary.payment_type_breakdown[type]) {
        summary.payment_type_breakdown[type] = { count: 0, total: 0 };
      }
      summary.payment_type_breakdown[type].count++;
      summary.payment_type_breakdown[type].total += tx.grand_total || 0;
    });

    // Format transactions with customer and company data
    const formattedTransactions = transactions.map(tx => ({
      id: tx._id,
      date: tx.date,
      subtotal: tx.subtotal,
      tax: tx.tax,
      discount: tx.discount,
      other_charges: tx.other_charges,
      grand_total: tx.grand_total,
      item_count: tx.item_count,
      unit_count: tx.unit_count,
      payment_type: tx.payment_type,
      status: tx.status,
      customer_name: tx.customer_id?.name,
      customer_phone: tx.customer_id?.phone,
      customer_email: tx.customer_id?.email,
      customer_address: tx.customer_id?.address,
      company_name: user?.company,
      items: tx.lines
    }));

    res.json({
      summary,
      transactions: formattedTransactions
    });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
};
