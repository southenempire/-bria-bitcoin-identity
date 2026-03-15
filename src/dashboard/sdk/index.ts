import {
  broadcastTransaction,
  makeContractCall,
  fetchCallReadOnlyFunction,
  cvToJSON,
  standardPrincipalCV,
  stringAsciiCV,
  bufferCV,
  uintCV,
} from '@stacks/transactions';
import { StacksNetwork } from '@stacks/network';

export interface AgentProfile {
  name: string;
  description: string;
  imageUrl: string;
  publicKey: Buffer;
  vouched: boolean;
  createdAt: number;
  principal?: string;
}

export class BriaSDK {
  public network: StacksNetwork;
  private contractAddress: string;
  private contractName: string;

  constructor(networkType: 'mainnet' | 'testnet' = 'testnet', contractAddress: string, contractName: string = 'bria-registry') {
    // Explicitly construct the network object to match StacksNetwork type
    const baseUrl = networkType === 'mainnet' 
      ? 'https://stacks-node-api.mainnet.stacks.co' 
      : 'https://stacks-node-api.testnet.stacks.co';
    
    // Low-level network configuration for Stacks
    this.network = {
      chainId: networkType === 'mainnet' ? 1 : 2147483648,
      transactionVersion: networkType === 'mainnet' ? 0x00 : 0x80,
      peerNetworkId: networkType === 'mainnet' ? 1 : 2147483648,
      magicBytes: networkType === 'mainnet' ? 'X2' : 'T2',
      bootAddress: networkType === 'mainnet' ? 'SP000000000000000000002Q6VF78' : 'ST000000000000000000002AMW42H',
      addressVersion: {
        singleSig: networkType === 'mainnet' ? 22 : 26,
        multiSig: networkType === 'mainnet' ? 20 : 21,
      },
      client: {
        baseUrl: baseUrl,
      }
    };
    
    this.contractAddress = contractAddress;
    this.contractName = contractName;
  }

  async getAgentProfile(agentAddress: string): Promise<AgentProfile | null> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: this.contractAddress,
        contractName: this.contractName,
        functionName: 'get-agent',
        functionArgs: [standardPrincipalCV(agentAddress)],
        network: this.network,
        senderAddress: agentAddress,
      });

      const jsonResult: any = cvToJSON(result);
      if (jsonResult.value) {
        return {
          name: jsonResult.value.name.value,
          description: jsonResult.value.description.value,
          imageUrl: jsonResult.value['image-url'].value,
          publicKey: Buffer.from(jsonResult.value['public-key'].value.replace('0x', ''), 'hex'),
          vouched: jsonResult.value.vouched.value,
          createdAt: parseInt(jsonResult.value['created-at'].value),
          principal: agentAddress
        };
      }
      return null;
    } catch (error) {
      console.error('Error fetching agent profile:', error);
      return null;
    }
  }

  async getTotalAgents(): Promise<number> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: this.contractAddress,
        contractName: this.contractName,
        functionName: 'get-total-agents',
        functionArgs: [],
        network: this.network as any,
        senderAddress: this.contractAddress,
      });
      const jsonResult: any = cvToJSON(result);
      return parseInt(jsonResult.value) || 0;
    } catch (error) {
      console.error('Error fetching total agents:', error);
      return 0;
    }
  }

  async getAgentById(id: number): Promise<AgentProfile | null> {
    try {
      const result = await fetchCallReadOnlyFunction({
        contractAddress: this.contractAddress,
        contractName: this.contractName,
        functionName: 'get-agent-by-id',
        functionArgs: [uintCV(id)],
        network: this.network as any,
        senderAddress: this.contractAddress,
      });

      const jsonResult: any = cvToJSON(result);
      if (jsonResult.value) {
        return {
          name: jsonResult.value.name.value,
          description: jsonResult.value.description.value,
          imageUrl: jsonResult.value['image-url'].value,
          publicKey: Buffer.from(jsonResult.value['public-key'].value.replace('0x', ''), 'hex'),
          vouched: jsonResult.value.vouched.value,
          createdAt: parseInt(jsonResult.value['created-at'].value),
        };
      }
      return null;
    } catch (error) {
      console.error(`Error fetching agent ID ${id}:`, error);
      return null;
    }
  }

  async registerAgent(
    senderKey: string,
    profile: Omit<AgentProfile, 'vouched' | 'createdAt'>
  ) {
    const transaction = await makeContractCall({
      contractAddress: this.contractAddress,
      contractName: this.contractName,
      functionName: 'register-agent',
      functionArgs: [
        stringAsciiCV(profile.name),
        stringAsciiCV(profile.description),
        stringAsciiCV(profile.imageUrl),
        bufferCV(profile.publicKey),
      ],
      senderKey: senderKey as any,
      network: this.network as any,
      postConditionMode: 0x01, // Allow
    } as any);

    const response = await broadcastTransaction({ transaction });
    return response;
  }
}
