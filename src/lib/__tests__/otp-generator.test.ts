import { generateOTP, hashOTP, verifyOTP } from '@/lib/otp-generator';

describe('OTP Generator', () => {
  describe('generateOTP', () => {
    it('should generate a 6-digit OTP', () => {
      const otp = generateOTP();
      expect(otp).toHaveLength(6);
      expect(/^\d{6}$/.test(otp)).toBe(true);
    });

    it('should generate different OTPs on multiple calls', () => {
      const otp1 = generateOTP();
      const otp2 = generateOTP();
      // While theoretically possible to be the same, extremely unlikely
      expect(otp1).not.toBe(otp2);
    });
  });

  describe('hashOTP', () => {
    it('should hash OTP and return a string', async () => {
      const otp = '123456';
      const hash = await hashOTP(otp);
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash).not.toBe(otp);
    });

    it('should generate different hashes for same OTP', async () => {
      const otp = '123456';
      const hash1 = await hashOTP(otp);
      const hash2 = await hashOTP(otp);
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('verifyOTP', () => {
    it('should return true for correct OTP', async () => {
      const otp = '123456';
      const hash = await hashOTP(otp);
      const isValid = await verifyOTP(otp, hash);
      expect(isValid).toBe(true);
    });

    it('should return false for incorrect OTP', async () => {
      const otp = '123456';
      const hash = await hashOTP(otp);
      const isValid = await verifyOTP('654321', hash);
      expect(isValid).toBe(false);
    });
  });
});