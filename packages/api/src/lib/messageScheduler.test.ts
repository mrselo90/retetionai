import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    scheduleUserMessage,
    scheduleOrderMessages,
    cancelOrderMessages,
    getUserScheduledMessages,
    type ScheduleMessageOptions,
} from './messageScheduler.js';
import { getSupabaseServiceClient } from '@recete/shared';
import { scheduleMessage } from '../queues.js';
import { decryptPhone } from './encryption.js';

// Mock dependencies
vi.mock('@recete/shared', () => ({
    getSupabaseServiceClient: vi.fn(),
}));

vi.mock('../queues.js', () => ({
    scheduleMessage: vi.fn(),
}));

vi.mock('./encryption.js', () => ({
    decryptPhone: vi.fn((phone) => phone.replace('encrypted_', '')),
}));

describe('Message Scheduler Module', () => {
    let mockSupabase: any;

    beforeEach(() => {
        vi.clearAllMocks();

        mockSupabase = {
            from: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            update: vi.fn().mockReturnThis(),
            single: vi.fn(),
            order: vi.fn().mockReturnThis(),
        };

        vi.mocked(getSupabaseServiceClient).mockReturnValue(mockSupabase);
    });

    describe('scheduleUserMessage', () => {
        const mockOptions: ScheduleMessageOptions = {
            userId: 'user-123',
            merchantId: 'merchant-123',
            messageType: 'welcome',
            scheduledFor: new Date('2026-03-01T10:00:00Z'),
            orderId: 'order-123',
            messageTemplate: 'Hello!',
        };

        it('should schedule message successfully', async () => {
            // Mock user lookup
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'user-123', phone: 'encrypted_1234567890' },
                error: null,
            });

            // Mock task creation
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'task-123' },
                error: null,
            });

            // Mock queue job
            vi.mocked(scheduleMessage).mockResolvedValue({ id: 'job-123' } as any);

            const result = await scheduleUserMessage(mockOptions);

            expect(result).toEqual({ taskId: 'task-123', jobId: 'job-123' });
            expect(decryptPhone).toHaveBeenCalledWith('encrypted_1234567890');
            expect(mockSupabase.insert).toHaveBeenCalledWith({
                merchant_id: mockOptions.merchantId,
                user_id: mockOptions.userId,
                order_id: mockOptions.orderId,
                task_type: mockOptions.messageType,
                execute_at: mockOptions.scheduledFor.toISOString(),
                status: 'pending',
            });
            expect(scheduleMessage).toHaveBeenCalledWith({
                type: mockOptions.messageType,
                userId: mockOptions.userId,
                orderId: mockOptions.orderId,
                merchantId: mockOptions.merchantId,
                to: '1234567890',
                message: mockOptions.messageTemplate,
                scheduledFor: mockOptions.scheduledFor.toISOString(),
            });
        });

        it('should throw error if user not found', async () => {
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Not found' },
            });

            await expect(scheduleUserMessage(mockOptions)).rejects.toThrow('User not found');
        });

        it('should throw error if task creation fails', async () => {
            // Mock user lookup
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'user-123', phone: 'encrypted_1234567890' },
                error: null,
            });

            // Mock task creation failure
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'DB error' },
            });

            await expect(scheduleUserMessage(mockOptions)).rejects.toThrow('Failed to create scheduled task');
        });
    });

    describe('scheduleOrderMessages', () => {
        const mockOrderId = 'order-123';
        const mockMerchantId = 'merchant-123';
        const mockDeliveryDate = new Date('2026-02-01T10:00:00Z');

        it('should schedule T+3 and T+14 messages', async () => {
            // Mock order lookup - using select chaining correctly
            mockSupabase.select.mockReturnThis();
            mockSupabase.eq.mockReturnThis();

            // Sequence of expected calls:
            // 1. Order lookup
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: mockOrderId, user_id: 'user-123', delivery_date: mockDeliveryDate.toISOString() },
                error: null,
            });

            // 2. User lookup (T+3)
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'user-123', phone: 'encrypted_1234567890' },
                error: null,
            });

            // 3. Task creation (T+3)
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'task-abc' },
                error: null,
            });

            // 4. User lookup (T+14)
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'user-123', phone: 'encrypted_1234567890' },
                error: null,
            });

            // 5. Task creation (T+14)
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'task-abc' },
                error: null,
            });

            mockSupabase.insert.mockReturnThis();

            // Mock queue job
            vi.mocked(scheduleMessage).mockResolvedValue({ id: 'job-abc' } as any);

            const result = await scheduleOrderMessages(mockOrderId, mockMerchantId, mockDeliveryDate);

            expect(result.tasks).toHaveLength(2);
            expect(result.tasks[0]).toEqual({ taskId: 'task-abc', jobId: 'job-abc' });
            expect(result.tasks[1]).toEqual({ taskId: 'task-abc', jobId: 'job-abc' });

            // Verify T+3 scheduling
            const t3Date = new Date(mockDeliveryDate);
            t3Date.setDate(t3Date.getDate() + 3);

            // Verify scheduleUserMessage was called implicitly via mock calls
            // We can check arguments passed to insert
            // First call should be checkin_t3
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                task_type: 'checkin_t3',
                execute_at: t3Date.toISOString(),
            }));

            // Verify T+14 scheduling
            const t14Date = new Date(mockDeliveryDate);
            t14Date.setDate(t14Date.getDate() + 14);

            // Second call should be checkin_t14
            expect(mockSupabase.insert).toHaveBeenCalledWith(expect.objectContaining({
                task_type: 'checkin_t14',
                execute_at: t14Date.toISOString(),
            }));
        });

        it('should throw error if order not found', async () => {
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'Not found' },
            });

            await expect(scheduleOrderMessages(mockOrderId, mockMerchantId, mockDeliveryDate))
                .rejects.toThrow('Order not found');
        });

        it('should handle partial failures gracefully', async () => {
            // Mock order lookup
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: mockOrderId, user_id: 'user-123', delivery_date: mockDeliveryDate.toISOString() },
                error: null,
            });

            // T+3 Sequence:
            // 1. User lookup
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'user-123', phone: 'encrypted_1234567890' },
                error: null,
            });
            // 2. Task creation (FAILS)
            mockSupabase.single.mockResolvedValueOnce({
                data: null,
                error: { message: 'DB error 1' }
            });

            // T+14 Sequence:
            // 3. User lookup
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'user-123', phone: 'encrypted_1234567890' },
                error: null,
            });
            // 4. Task creation (SUCCEEDS)
            mockSupabase.single.mockResolvedValueOnce({
                data: { id: 'task-2' },
                error: null
            });

            // Mock queue job for second call
            vi.mocked(scheduleMessage).mockResolvedValue({ id: 'job-2' } as any);

            const result = await scheduleOrderMessages(mockOrderId, mockMerchantId, mockDeliveryDate);

            expect(result.tasks).toHaveLength(1);
            expect(result.tasks[0].taskId).toBe('task-2');
        });
    });

    describe('cancelOrderMessages', () => {
        const mockMerchantId = 'merchant-123';

        it('should cancel pending messages', async () => {
            mockSupabase.select.mockResolvedValue({
                data: [{ id: 'task-1' }, { id: 'task-2' }],
                error: null,
            });

            const result = await cancelOrderMessages('order-123', mockMerchantId);

            expect(result.cancelled).toBe(2);
            expect(mockSupabase.update).toHaveBeenCalledWith({ status: 'cancelled' });
            expect(mockSupabase.eq).toHaveBeenCalledWith('order_id', 'order-123');
            expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'pending');
        });

        it('should return 0 cancelled if no tasks found', async () => {
            mockSupabase.select.mockResolvedValue({
                data: [],
                error: null,
            });

            const result = await cancelOrderMessages('order-123', mockMerchantId);

            expect(result.cancelled).toBe(0);
        });

        it('should throw error on update failure', async () => {
            mockSupabase.select.mockResolvedValue({
                data: null,
                error: { message: 'Update failed' },
            });

            await expect(cancelOrderMessages('order-123', mockMerchantId)).rejects.toThrow('Failed to cancel messages');
        });
    });

    describe('getUserScheduledMessages', () => {
        it('should return pending messages', async () => {
            const mockTasks = [
                { id: 'task-1', task_type: 'checkin_t3' },
                { id: 'task-2', task_type: 'checkin_t14' },
            ];

            mockSupabase.order.mockResolvedValue({
                data: mockTasks,
                error: null,
            });

            const result = await getUserScheduledMessages('user-123', 'merchant-123');

            expect(result).toEqual(mockTasks);
            expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-123');
            expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'pending');
            expect(mockSupabase.order).toHaveBeenCalledWith('execute_at', { ascending: true });
        });

        it('should return empty array on database error', async () => {
            mockSupabase.order.mockResolvedValue({
                data: null,
                error: { message: 'DB error' },
            });

            await expect(getUserScheduledMessages('user-123', 'merchant-123'))
                .rejects.toThrow('Failed to get scheduled messages');
        });

        it('should return empty array if no tasks found', async () => {
            mockSupabase.order.mockResolvedValue({
                data: null,
                error: null,
            });

            const result = await getUserScheduledMessages('user-123', 'merchant-123');

            expect(result).toEqual([]);
        });
    });
});
