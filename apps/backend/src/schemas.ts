import {
	addressSchema,
	networkSchema,
	tokenSymbolSchema,
} from "@payproof/domain";
import { z } from "zod";

export const createAccountSchema = z.object({
	displayName: z.string().trim().min(1),
	email: z.email(),
	password: z.string().min(8).optional(),
	walletAddress: addressSchema,
	network: networkSchema.default("celo-sepolia"),
});

export const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

export const upsertContactSchema = z.object({
	alias: z.string().trim().min(1).max(50),
	walletAddress: addressSchema,
	network: networkSchema.default("celo-sepolia"),
	preferredToken: tokenSymbolSchema.default("USDC"),
});

export const walletParamsSchema = z.object({
	walletAddress: addressSchema,
});

export const userParamsSchema = z.object({
	userId: z.string().min(1),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpsertContactInput = z.infer<typeof upsertContactSchema>;

export type PayproofUser = {
	id: string;
	displayName: string;
	email: string;
	walletAddress: `0x${string}`;
	network: "celo-sepolia" | "celo";
	createdAt: string;
	updatedAt: string;
};

export type PayproofContact = {
	id: string;
	userId: string;
	alias: string;
	walletAddress: `0x${string}`;
	network: "celo-sepolia" | "celo";
	preferredToken: "USDC" | "USDm";
	createdAt: string;
	updatedAt: string;
};
