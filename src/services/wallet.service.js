import { DriverWallet, WalletTransaction } from '../models/wallet.model.js';
import Driver from '../models/driver.model.js';
import ApiError from '../utils/ApiError.js';

export class WalletService {

  // ── Internal helpers ────────────────────────────────────────────────────────

  /**
   * Get or lazily create a wallet for a driver.
   */
  static async _getOrCreate(driverId) {
    let wallet = await DriverWallet.findOne({ driver: driverId });
    if (!wallet) {
      wallet = await DriverWallet.create({ driver: driverId });
    }
    return wallet;
  }

  /**
   * Resolve driverId from a userId (driver self-service calls).
   */
  static async _driverIdFromUserId(userId) {
    const driver = await Driver.findOne({ user: userId, isDeleted: false }).select('_id bankDetails name');
    if (!driver) throw new ApiError(404, 'Driver profile not found');
    return driver;
  }

  // ── Admin: credit a driver's wallet ─────────────────────────────────────────

  /**
   * Credit a driver wallet (advance, balance payment, or manual adjustment).
   *
   * @param {string} driverId
   * @param {object} opts
   * @param {number}  opts.amount
   * @param {'advance'|'balance'|'adjustment'} opts.type
   * @param {string}  [opts.booking]     - Booking ObjectId (for advance/balance)
   * @param {string}  [opts.bookingRef]  - Human label e.g. "#4777181 Jalna - Pune"
   * @param {string}  [opts.note]
   * @param {string}  [opts.createdBy]   - Staff user ID
   */
  static async credit(driverId, { amount, type, booking, bookingRef, note, createdBy }) {
    if (!amount || amount <= 0) throw new ApiError(400, 'Amount must be positive');

    const wallet = await this._getOrCreate(driverId);
    const newBalance = wallet.balance + amount;

    const TITLES = { advance: 'Advance', balance: 'Balance', adjustment: 'Adjustment' };

    const tx = await WalletTransaction.create({
      driver: driverId,
      type,
      direction: 'credit',
      amount,
      runningBalance: newBalance,
      title: TITLES[type] || type,
      subtitle: bookingRef || '',
      booking: booking || undefined,
      status: 'completed',
      note,
      createdBy,
    });

    await DriverWallet.findByIdAndUpdate(wallet._id, {
      $inc: { balance: amount, totalCredits: amount },
      lastTransactionAt: new Date(),
    });

    return tx;
  }

  // ── Driver: request payout ───────────────────────────────────────────────────

  /**
   * Driver requests a bank withdrawal. Balance is reserved immediately.
   *
   * @param {string} userId - Authenticated driver user
   * @param {number} amount
   * @param {string} [note]
   */
  static async requestPayout(userId, amount, note) {
    if (!amount || amount <= 0) throw new ApiError(400, 'Amount must be positive');

    const driver = await this._driverIdFromUserId(userId);
    const wallet = await this._getOrCreate(driver._id);

    if (wallet.balance < amount) {
      throw new ApiError(400, `Insufficient balance. Available: ₹${wallet.balance}`);
    }
    if (!driver.bankDetails?.accountNumber) {
      throw new ApiError(400, 'Bank account details not set. Please update your profile.');
    }

    const newBalance = wallet.balance - amount;

    const tx = await WalletTransaction.create({
      driver: driver._id,
      type: 'payout',
      direction: 'debit',
      amount,
      runningBalance: newBalance,
      title: 'Paid To Bank',
      subtitle: `A/C No: ${driver.bankDetails.accountNumber?.slice(-4).padStart(driver.bankDetails.accountNumber.length, '*')}`,
      status: 'pending',
      bankDetails: { ...driver.bankDetails },
      note,
    });

    // Reserve balance immediately so driver can't double-withdraw
    await DriverWallet.findByIdAndUpdate(wallet._id, {
      $inc: { balance: -amount },
      lastTransactionAt: new Date(),
    });

    return tx;
  }

  // ── Admin: approve a pending payout ─────────────────────────────────────────

  /**
   * Mark payout as approved (money sent to bank).
   *
   * @param {string} transactionId
   * @param {string} [utrNumber] - Bank UTR/reference number
   * @param {string} processedBy - Staff user ID
   */
  static async approvePayout(transactionId, utrNumber, processedBy) {
    const tx = await WalletTransaction.findById(transactionId);
    if (!tx || tx.type !== 'payout') throw new ApiError(404, 'Payout transaction not found');
    if (tx.status !== 'pending') throw new ApiError(400, `Payout is already ${tx.status}`);

    await tx.updateOne({
      status: 'approved',
      'bankDetails.utrNumber': utrNumber,
      subtitle: utrNumber ? `Ref No: ${utrNumber}` : tx.subtitle,
      processedBy,
      processedAt: new Date(),
    });

    // totalDebits only incremented on approval (confirmed payout)
    await DriverWallet.findOneAndUpdate(
      { driver: tx.driver },
      { $inc: { totalDebits: tx.amount }, lastTransactionAt: new Date() }
    );

    return tx;
  }

  // ── Admin: reject a pending payout ──────────────────────────────────────────

  /**
   * Reject a pending payout and refund the reserved balance.
   *
   * @param {string} transactionId
   * @param {string} reason
   * @param {string} processedBy - Staff user ID
   */
  static async rejectPayout(transactionId, reason, processedBy) {
    const tx = await WalletTransaction.findById(transactionId);
    if (!tx || tx.type !== 'payout') throw new ApiError(404, 'Payout transaction not found');
    if (tx.status !== 'pending') throw new ApiError(400, `Payout is already ${tx.status}`);

    const wallet = await DriverWallet.findOne({ driver: tx.driver });
    const restoredBalance = (wallet?.balance ?? 0) + tx.amount;

    await Promise.all([
      tx.updateOne({
        status: 'rejected',
        runningBalance: restoredBalance,
        payoutNote: reason,
        processedBy,
        processedAt: new Date(),
      }),
      DriverWallet.findOneAndUpdate(
        { driver: tx.driver },
        { $inc: { balance: tx.amount }, lastTransactionAt: new Date() }
      ),
    ]);

    return tx;
  }

  // ── Driver: get own wallet ───────────────────────────────────────────────────

  /**
   * Return balance + paginated transaction history for the calling driver.
   */
  static async getMyWallet(userId, page = 1, limit = 20) {
    const driver = await this._driverIdFromUserId(userId);
    const wallet = await this._getOrCreate(driver._id);

    const result = await WalletTransaction.paginate(
      { driver: driver._id },
      {
        page,
        limit,
        sort: { createdAt: -1 },
        lean: true,
      }
    );

    return {
      balance: wallet.balance,
      totalCredits: wallet.totalCredits,
      totalDebits: wallet.totalDebits,
      transactions: result.data.map(tx => ({
        _id: tx._id,
        type: tx.type,
        direction: tx.direction,
        amount: tx.direction === 'debit' ? -tx.amount : tx.amount,
        runningBalance: tx.runningBalance,
        title: tx.title,
        subtitle: tx.subtitle,
        status: tx.status,
        date: tx.createdAt,
        booking: tx.booking,
      })),
      pagination: result.pagination,
    };
  }

  // ── Admin: get any driver wallet ─────────────────────────────────────────────

  static async getDriverWallet(driverId, page = 1, limit = 20) {
    const wallet = await this._getOrCreate(driverId);

    const result = await WalletTransaction.paginate(
      { driver: driverId },
      { page, limit, sort: { createdAt: -1 }, lean: true }
    );

    return {
      balance: wallet.balance,
      totalCredits: wallet.totalCredits,
      totalDebits: wallet.totalDebits,
      transactions: result.docs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.totalDocs,
        pages: result.totalPages,
      },
    };
  }

  // ── Admin: list pending payouts ──────────────────────────────────────────────

  static async getPendingPayouts(page = 1, limit = 20) {
    const result = await WalletTransaction.paginate(
      { type: 'payout', status: 'pending' },
      {
        page,
        limit,
        sort: { createdAt: 1 }, // oldest first
        populate: { path: 'driver', select: 'name' },
        lean: true,
      }
    );

    return {
      payouts: result.docs,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.totalDocs,
        pages: result.totalPages,
      },
    };
  }
}
