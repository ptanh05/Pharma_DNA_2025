/**
 * Event Indexer Service
 * Indexes blockchain events for fast queries and analytics
 */

import { SuiClient } from '@mysten/sui.js/client';
import { getSuiClient, getPackageId } from '../blockchain/provider-sui';

// Event types matching Move contract events
export interface NFTMintedEvent {
    type: 'NFTMinted';
    nft_id: string;
    batch_number: string;
    product_name: string;
    manufacturer: string;
    manufacturing_date: number;
    expiration_date: number;
    metadata_uri: string;
    timestamp: number;
}

export interface NFTTransferredEvent {
    type: 'NFTTransferred';
    nft_id: string;
    from: string;
    to: string;
    from_role: number;
    to_role: number;
    new_status: number;
    timestamp: number;
}

export interface StatusUpdatedEvent {
    type: 'StatusUpdated';
    nft_id: string;
    old_status: number;
    new_status: number;
    updater: string;
    updater_role: number;
    reason: string;
    timestamp: number;
}

export interface RoleUpdatedEvent {
    type: 'RoleUpdated';
    wallet_address: string;
    old_role: number;
    new_role: number;
    updated_by: string;
    timestamp: number;
}

export interface ParticipantVerifiedEvent {
    type: 'ParticipantVerified';
    participant_id: string;
    wallet_address: string;
    verified_by: string;
    timestamp: number;
}

export interface NFTBurnedEvent {
    type: 'NFTBurned';
    nft_id: string;
    batch_number: string;
    reason: number;
    burned_by: string;
    timestamp: number;
}

export type BlockchainEvent =
    | NFTMintedEvent
    | NFTTransferredEvent
    | StatusUpdatedEvent
    | RoleUpdatedEvent
    | ParticipantVerifiedEvent
    | NFTBurnedEvent;

// Indexed data storage interfaces
export interface IndexedNFT {
    objectId: string;
    batchNumber: string;
    productName: string;
    currentOwner: string;
    manufacturer: string;
    status: number;
    expirationDate: number;
    createdAt: number;
    updatedAt: number;
    history: IndexedTransfer[];
}

export interface IndexedTransfer {
    from: string;
    to: string;
    timestamp: number;
    role: number;
    transactionDigest: string;
}

export interface IndexedParticipant {
    address: string;
    role: number;
    isVerified: boolean;
    registeredAt: number;
    lastActiveAt: number;
}

export interface IndexerStats {
    lastIndexedCheckpoint: number;
    totalEvents: number;
    totalNFTs: number;
    totalParticipants: number;
    lastUpdateTime: Date;
}

export class EventIndexer {
    private client: SuiClient;
    private packageId: string;
    private checkpoint: number;
    private isRunning: boolean;

    // In-memory indexes (would use database in production)
    private nfts: Map<string, IndexedNFT> = new Map();
    private participants: Map<string, IndexedParticipant> = new Map();
    private events: BlockchainEvent[] = [];

    constructor() {
        this.client = getSuiClient();
        this.packageId = getPackageId() ?? '';
        this.checkpoint = 0;
        this.isRunning = false;
    }

    /**
     * Start indexing from a specific checkpoint
     */
    async start(checkpoint?: number): Promise<void> {
        if (this.isRunning) {
            return;
        }

        this.isRunning = true;

        if (checkpoint !== undefined) {
            this.checkpoint = checkpoint;
        } else {
            // Start from latest checkpoint minus some buffer
            try {
                const latest = await this.client.getLatestCheckpointSequenceNumber();
                this.checkpoint = Math.max(0, Number(latest) - 100);
            } catch {
                this.checkpoint = 0;
            }
        }

        await this.indexLoop();
    }

    /**
     * Stop the indexer
     */
    stop(): void {
        this.isRunning = false;
    }

    /**
     * Main indexing loop
     */
    private async indexLoop(): Promise<void> {
        while (this.isRunning) {
            try {
                await this.indexNextBatch();
                // Small delay to avoid overwhelming the RPC
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.error('Indexing error:', error);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
    }

    /**
     * Index the next batch of events
     */
    private async indexNextBatch(): Promise<void> {
        const latestCheckpoint = Number(await this.client.getLatestCheckpointSequenceNumber());

        if (this.checkpoint >= latestCheckpoint) {
            return; // Caught up
        }

        // Index a batch of checkpoints (e.g., 100 at a time)
        const batchSize = 100;
        const endCheckpoint = Math.min(this.checkpoint + batchSize, latestCheckpoint);

        for (let cp = this.checkpoint; cp < endCheckpoint; cp++) {
            try {
                await this.indexCheckpoint(cp);
            } catch (error) {
                console.error(`Error indexing checkpoint ${cp}:`, error);
            }
        }

        this.checkpoint = endCheckpoint;
    }

    /**
     * Index a specific checkpoint
     */
    private async indexCheckpoint(checkpoint: number): Promise<void> {
        const checkpointInfo = await this.client.getCheckpoint({ id: `${checkpoint}` });
        const transactions = checkpointInfo.transactions || [];

        for (const txDigest of transactions) {
            try {
                const txInfo = await this.client.getTransactionBlock({
                    digest: txDigest,
                    options: {
                        showInput: true,
                        showEffects: true,
                        showEvents: true,
                        showObjectChanges: true,
                    },
                });

                // Process events
                if (txInfo.events && Array.isArray(txInfo.events)) {
                    for (const event of txInfo.events) {
                        const parsedEvent = this.parseEvent(event, txDigest);
                        if (parsedEvent) {
                            this.events.push(parsedEvent);
                            await this.processEvent(parsedEvent);
                        }
                    }
                }
            } catch (error) {
                console.error(`Error processing transaction ${txDigest}:`, error);
            }
        }
    }

    /**
     * Parse raw event to typed event
     */
    private parseEvent(event: any, txDigest: string): BlockchainEvent | null {
        try {
            const eventType = event.type;
            const parsedJson = typeof event.parsedJson === 'string'
                ? JSON.parse(event.parsedJson)
                : event.parsedJson;

            switch (true) {
                case eventType.includes('NFTMinted'):
                    return {
                        type: 'NFTMinted',
                        nft_id: parsedJson.nft_id?.['id'] || parsedJson.object_id || '',
                        batch_number: parsedJson.batch_number || '',
                        product_name: parsedJson.product_name || '',
                        manufacturer: parsedJson.manufacturer || '',
                        manufacturing_date: Number(parsedJson.manufacturing_date) || 0,
                        expiration_date: Number(parsedJson.expiration_date) || 0,
                        metadata_uri: parsedJson.metadata_uri || '',
                        timestamp: Number(parsedJson.timestamp) || 0,
                    } as NFTMintedEvent;

                case eventType.includes('NFTTransferred'):
                    return {
                        type: 'NFTTransferred',
                        nft_id: parsedJson.nft_id?.['id'] || parsedJson.object_id || '',
                        from: parsedJson.from || '',
                        to: parsedJson.to || '',
                        from_role: Number(parsedJson.from_role) || 0,
                        to_role: Number(parsedJson.to_role) || 0,
                        new_status: Number(parsedJson.new_status) || 0,
                        timestamp: Number(parsedJson.timestamp) || 0,
                    } as NFTTransferredEvent;

                case eventType.includes('StatusUpdated'):
                    return {
                        type: 'StatusUpdated',
                        nft_id: parsedJson.nft_id?.['id'] || parsedJson.object_id || '',
                        old_status: Number(parsedJson.old_status) || 0,
                        new_status: Number(parsedJson.new_status) || 0,
                        updater: parsedJson.updater || '',
                        updater_role: Number(parsedJson.updater_role) || 0,
                        reason: parsedJson.reason || '',
                        timestamp: Number(parsedJson.timestamp) || 0,
                    } as StatusUpdatedEvent;

                case eventType.includes('RoleUpdated'):
                    return {
                        type: 'RoleUpdated',
                        wallet_address: parsedJson.wallet_address || '',
                        old_role: Number(parsedJson.old_role) || 0,
                        new_role: Number(parsedJson.new_role) || 0,
                        updated_by: parsedJson.updated_by || '',
                        timestamp: Number(parsedJson.timestamp) || 0,
                    } as RoleUpdatedEvent;

                case eventType.includes('ParticipantVerified'):
                    return {
                        type: 'ParticipantVerified',
                        participant_id: parsedJson.participant_id?.['id'] || '',
                        wallet_address: parsedJson.wallet_address || '',
                        verified_by: parsedJson.verified_by || '',
                        timestamp: Number(parsedJson.timestamp) || 0,
                    } as ParticipantVerifiedEvent;

                case eventType.includes('NFTBurned'):
                    return {
                        type: 'NFTBurned',
                        nft_id: parsedJson.nft_id?.['id'] || parsedJson.object_id || '',
                        batch_number: parsedJson.batch_number || '',
                        reason: Number(parsedJson.reason) || 0,
                        burned_by: parsedJson.burned_by || '',
                        timestamp: Number(parsedJson.timestamp) || 0,
                    } as NFTBurnedEvent;

                default:
                    return null;
            }
        } catch (error) {
            console.error('Error parsing event:', error);
            return null;
        }
    }

    /**
     * Process and index a parsed event
     */
    private async processEvent(event: BlockchainEvent): Promise<void> {
        switch (event.type) {
            case 'NFTMinted':
                await this.indexMintEvent(event);
                break;
            case 'NFTTransferred':
                await this.indexTransferEvent(event);
                break;
            case 'RoleUpdated':
                await this.indexRoleUpdate(event);
                break;
            case 'ParticipantVerified':
                await this.indexVerification(event);
                break;
        }
    }

    private async indexMintEvent(event: NFTMintedEvent): Promise<void> {
        const nft: IndexedNFT = {
            objectId: event.nft_id,
            batchNumber: event.batch_number,
            productName: event.product_name,
            currentOwner: event.manufacturer,
            manufacturer: event.manufacturer,
            status: 0, // CREATED
            expirationDate: event.expiration_date,
            createdAt: event.timestamp,
            updatedAt: event.timestamp,
            history: [],
        };

        this.nfts.set(event.nft_id, nft);

        // Update participant
        this.updateParticipant(event.manufacturer, 1, event.timestamp);
    }

    private async indexTransferEvent(event: NFTTransferredEvent): Promise<void> {
        const nft = this.nfts.get(event.nft_id);
        if (nft) {
            const transfer: IndexedTransfer = {
                from: event.from,
                to: event.to,
                timestamp: event.timestamp,
                role: event.to_role,
                transactionDigest: '', // Would have from tx
            };

            nft.history.push(transfer);
            nft.currentOwner = event.to;
            nft.status = event.new_status;
            nft.updatedAt = event.timestamp;

            this.nfts.set(event.nft_id, nft);

            // Update participants
            this.updateParticipant(event.from, event.from_role, event.timestamp);
            this.updateParticipant(event.to, event.to_role, event.timestamp);
        }
    }

    private async indexRoleUpdate(event: RoleUpdatedEvent): Promise<void> {
        this.updateParticipant(
            event.wallet_address,
            event.new_role,
            event.timestamp
        );
    }

    private async indexVerification(event: ParticipantVerifiedEvent): Promise<void> {
        const participant = this.participants.get(event.wallet_address);
        if (participant) {
            participant.isVerified = true;
            participant.lastActiveAt = event.timestamp;
            this.participants.set(event.wallet_address, participant);
        }
    }

    private updateParticipant(address: string, role: number, timestamp: number): void {
        const existing = this.participants.get(address);
        if (existing) {
            existing.role = role;
            existing.lastActiveAt = timestamp;
            this.participants.set(address, existing);
        } else {
            this.participants.set(address, {
                address,
                role,
                isVerified: false,
                registeredAt: timestamp,
                lastActiveAt: timestamp,
            });
        }
    }

    // ========== Public Query Methods ==========

    /**
     * Get NFT by object ID
     */
    getNFT(objectId: string): IndexedNFT | undefined {
        return this.nfts.get(objectId);
    }

    /**
     * Get NFTs by owner
     */
    getNFTsByOwner(owner: string): IndexedNFT[] {
        const results: IndexedNFT[] = [];
        for (const nft of this.nfts.values()) {
            if (nft.currentOwner.toLowerCase() === owner.toLowerCase()) {
                results.push(nft);
            }
        }
        return results;
    }

    /**
     * Get NFTs by manufacturer
     */
    getNFTsByManufacturer(manufacturer: string): IndexedNFT[] {
        const results: IndexedNFT[] = [];
        for (const nft of this.nfts.values()) {
            if (nft.manufacturer.toLowerCase() === manufacturer.toLowerCase()) {
                results.push(nft);
            }
        }
        return results;
    }

    /**
     * Get NFTs by batch number
     */
    getNFTsByBatchNumber(batchNumber: string): IndexedNFT | undefined {
        for (const nft of this.nfts.values()) {
            if (nft.batchNumber.toLowerCase() === batchNumber.toLowerCase()) {
                return nft;
            }
        }
        return undefined;
    }

    /**
     * Get NFT transfer history
     */
    getTransferHistory(objectId: string): IndexedTransfer[] {
        const nft = this.nfts.get(objectId);
        return nft?.history || [];
    }

    /**
     * Get participant by address
     */
    getParticipant(address: string): IndexedParticipant | undefined {
        return this.participants.get(address);
    }

    /**
     * Get all verified participants
     */
    getVerifiedParticipants(): IndexedParticipant[] {
        const results: IndexedParticipant[] = [];
        for (const participant of this.participants.values()) {
            if (participant.isVerified) {
                results.push(participant);
            }
        }
        return results;
    }

    /**
     * Get events by type
     */
    getEventsByType<T extends BlockchainEvent>(type: T['type']): T[] {
        return this.events.filter(e => e.type === type) as T[];
    }

    /**
     * Get recent events
     */
    getRecentEvents(limit: number = 100): BlockchainEvent[] {
        const start = Math.max(0, this.events.length - limit);
        return this.events.slice(start);
    }

    /**
     * Get statistics
     */
    getStats(): IndexerStats {
        return {
            lastIndexedCheckpoint: this.checkpoint,
            totalEvents: this.events.length,
            totalNFTs: this.nfts.size,
            totalParticipants: this.participants.size,
            lastUpdateTime: new Date(),
        };
    }

    /**
     * Search NFTs
     */
    searchNFTs(query: {
        owner?: string;
        manufacturer?: string;
        status?: number;
        fromDate?: number;
        toDate?: number;
    }): IndexedNFT[] {
        const results: IndexedNFT[] = [];

        for (const nft of this.nfts.values()) {
            let match = true;

            if (query.owner && nft.currentOwner.toLowerCase() !== query.owner.toLowerCase()) {
                match = false;
            }
            if (query.manufacturer && nft.manufacturer.toLowerCase() !== query.manufacturer.toLowerCase()) {
                match = false;
            }
            if (query.status !== undefined && nft.status !== query.status) {
                match = false;
            }
            if (query.fromDate && nft.createdAt < query.fromDate) {
                match = false;
            }
            if (query.toDate && nft.createdAt > query.toDate) {
                match = false;
            }

            if (match) {
                results.push(nft);
            }
        }

        return results;
    }
}

// Export singleton instance
let indexerInstance: EventIndexer | null = null;

export function getEventIndexer(): EventIndexer {
    if (!indexerInstance) {
        indexerInstance = new EventIndexer();
    }
    return indexerInstance;
}

export default EventIndexer;
