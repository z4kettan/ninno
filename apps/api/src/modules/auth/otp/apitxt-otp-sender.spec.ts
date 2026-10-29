import { Logger } from '@nestjs/common';
import { ApitxtOtpSender } from './apitxt-otp-sender';
import { OtpDeliveryError } from './otp-sender';

const PHONE = '+919876543210' as const;
const CODE = '482913';
const options = {
  baseUrl: 'https://apitxt.example',
  authKey: 'secret-auth-key',
  channel: 'sms' as const,
  templateId: undefined,
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('ApitxtOtpSender', () => {
  let logged: string[];

  beforeEach(() => {
    logged = [];
    for (const level of ['log', 'warn', 'error', 'debug'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
        logged.push(JSON.stringify(args));
      });
    }
  });

  afterEach(() => jest.restoreAllMocks());

  /** Codes, full numbers and the auth key must never reach the logs. */
  const expectCleanLogs = () => {
    const all = logged.join('\n');
    expect(all).not.toContain(CODE);
    expect(all).not.toContain('9876543210');
    expect(all).not.toContain('secret-auth-key');
  };

  it('posts the documented form fields and resolves on success', async () => {
    const fetchFn = jest.fn().mockResolvedValue(
      json(200, {
        status: 'success',
        message: 'Sms OTP Sent Successfully',
        data: { request_id: 'SMS-OTP-A1B2C3D4', mobile: '919876543210', cost: 0.25 },
      }),
    );
    await new ApitxtOtpSender({ ...options, templateId: '42' }, fetchFn).send(PHONE, CODE);

    const [url, init] = fetchFn.mock.calls[0];
    expect(String(url)).toBe('https://apitxt.example/api/sendOTP');
    expect(init.method).toBe('POST');
    expect(init.headers['content-type']).toBe('application/x-www-form-urlencoded');
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({
      authkey: 'secret-auth-key',
      mobile: '919876543210',
      otp: CODE,
      channel: 'sms',
      template_id: '42',
    });
    expectCleanLogs();
  });

  it('throws OtpDeliveryError on AUTH_FAILED and logs only masked data', async () => {
    const fetchFn = jest
      .fn()
      .mockResolvedValue(json(401, { status: 'AUTH_FAILED', message: 'Invalid Auth Key' }));
    await expect(new ApitxtOtpSender(options, fetchFn).send(PHONE, CODE)).rejects.toThrow(
      OtpDeliveryError,
    );
    expect(logged.join('\n')).toContain('AUTH_FAILED');
    expect(logged.join('\n')).toContain('3210');
    expectCleanLogs();
  });

  it('treats a 200 without status "success" as a failure', async () => {
    const fetchFn = jest.fn().mockResolvedValue(json(200, { status: 'INSUFFICIENT_BALANCE' }));
    await expect(new ApitxtOtpSender(options, fetchFn).send(PHONE, CODE)).rejects.toThrow(
      OtpDeliveryError,
    );
    expectCleanLogs();
  });

  it('throws OtpDeliveryError on timeout', async () => {
    const timeout = Object.assign(new Error('The operation timed out'), { name: 'TimeoutError' });
    const fetchFn = jest.fn().mockRejectedValue(timeout);
    await expect(new ApitxtOtpSender(options, fetchFn).send(PHONE, CODE)).rejects.toThrow(
      /timeout/,
    );
    expectCleanLogs();
  });

  it('throws OtpDeliveryError when the body is not JSON', async () => {
    const fetchFn = jest.fn().mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    await expect(new ApitxtOtpSender(options, fetchFn).send(PHONE, CODE)).rejects.toThrow(
      OtpDeliveryError,
    );
    expectCleanLogs();
  });
});
