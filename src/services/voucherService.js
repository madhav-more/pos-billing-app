import { v4 as uuidv4 } from 'uuid';
import { database } from '../db';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

class VoucherService {
  constructor() {
    this.voucherCache = {};
  }

  generateProvisionalVoucher() {
    const uuid = uuidv4();
    return `PROV-${uuid}`;
  }

  async getCompanyCode(userId) {
    try {
      const settingsCollection = database.collections.get('settings');
      const settings = await settingsCollection.query().fetch();
      
      const companyCode = settings.find(s => s.key === 'company_code')?.value || 
                          settings.find(s => s.key === 'company')?.value?.substring(0, 3).toUpperCase() ||
                          'GUR';
      
      return companyCode.toUpperCase();
    } catch (error) {
      console.error('Error getting company code:', error);
      return 'GUR';
    }
  }

  formatDate(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }

  async getDailySequence(companyCode, date = new Date()) {
    try {
      const dateStr = this.formatDate(date);
      const transactionsCollection = database.collections.get('transactions');
      
      const transactionsForDay = await transactionsCollection.query(
        `date = '${dateStr}' AND voucher_number LIKE '${companyCode}-${dateStr}-%'`
      ).fetch();
      
      const sequences = transactionsForDay
        .map(t => {
          const match = t.voucher_number?.match(/-(\d+)$/);
          return match ? parseInt(match[1]) : 0;
        })
        .filter(seq => !isNaN(seq));
      
      const maxSequence = sequences.length > 0 ? Math.max(...sequences) : 0;
      return maxSequence + 1;
    } catch (error) {
      console.error('Error getting daily sequence:', error);
      return 1;
    }
  }

  async generateProvisionalVoucherNumber(userId) {
    try {
      const companyCode = await this.getCompanyCode(userId);
      const dateStr = this.formatDate();
      const provisional = this.generateProvisionalVoucher();
      
      return {
        provisional_voucher: provisional,
        voucher_format: `${companyCode}-${dateStr}-SEQ`,
      };
    } catch (error) {
      console.error('Error generating provisional voucher:', error);
      return {
        provisional_voucher: `PROV-${uuidv4()}`,
        voucher_format: 'GUR-YYYYMMDD-SEQ',
      };
    }
  }

  async confirmVoucherNumber(provisionalVoucher, finalVoucherNumber, transactionId, userId, token) {
    try {
      const transactionsCollection = database.collections.get('transactions');
      
      const transaction = await transactionsCollection.query(
        `local_id = '${transactionId}'`
      ).fetchOne().catch(() => null);
      
      if (transaction) {
        await database.write(async () => {
          await transaction.update(t => {
            t.voucher_number = finalVoucherNumber;
            t.provisional_voucher = null;
            t.updated_at = Date.now();
          });
        });
      }

      console.log('✅ Voucher number confirmed:', finalVoucherNumber);
      return { success: true, voucher_number: finalVoucherNumber };
    } catch (error) {
      console.error('Error confirming voucher number:', error);
      return { success: false, error: error.message };
    }
  }

  async initializeDailySyncForVouchers(userId, token) {
    try {
      const companyCode = await this.getCompanyCode(userId);
      const dateStr = this.formatDate();
      
      const response = await fetch(`${API_BASE_URL}/vouchers/init-daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          company_code: companyCode,
          date: dateStr,
          user_id: userId,
        }),
      });

      const data = await response.json();
      
      if (response.ok) {
        this.voucherCache[dateStr] = data.next_sequence || 1;
        return { success: true, next_sequence: data.next_sequence };
      } else {
        console.error('Server voucher init error:', data.error);
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Error initializing daily vouchers:', error);
      return { success: false, error: error.message };
    }
  }
}

export default new VoucherService();
