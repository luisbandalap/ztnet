import { TRPCError } from "@trpc/server";
import { getHTTPStatusCodeFromError } from "@trpc/server/http";
import type { NextApiRequest, NextApiResponse } from "next";
import { createNetworkService } from "~/server/api/services/networkService";
import { prisma } from "~/server/db";
import { decryptAndVerifyToken } from "~/utils/encryption";
import rateLimit from "~/utils/rateLimit";
import * as ztController from "~/utils/ztApi";

// Number of allowed requests per minute
const limiter = rateLimit({
	interval: 60 * 1000, // 60 seconds
	uniqueTokenPerInterval: 500, // Max 500 users per second
});

const REQUEST_PR_MINUTE = 50;

export default async function apiNetworkHandler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	try {
		await limiter.check(res, REQUEST_PR_MINUTE, "CREATE_USER_CACHE_TOKEN"); // 10 requests per minute
	} catch {
		return res.status(429).json({ error: "Rate limit exceeded" });
	}

	// create a switch based on the HTTP method
	switch (req.method) {
		case "GET":
			await GET_userNetworks(req, res);
			break;
		case "POST":
			await POST_createNewNetwork(req, res);
			break;
		default: // Method Not Allowed
			res.status(405).end();
			break;
	}
}

const POST_createNewNetwork = async (req: NextApiRequest, res: NextApiResponse) => {
	const apiKey = req.headers["x-ztnet-auth"] as string;

	let decryptedData: { userId: string; name: string };

	// If there are users, verify the API key
	try {
		decryptedData = await decryptAndVerifyToken({ apiKey });
	} catch (error) {
		return res.status(401).json({ error: error.message });
	}
	const { name } = req.body;

	const ctx = {
		session: {
			user: {
				id: decryptedData.userId as string,
			},
		},
		prisma,
	};

	const newNetworkId = await createNetworkService({
		ctx,
		input: { central: false, name },
	});

	return res.status(200).json(newNetworkId);
};

const GET_userNetworks = async (req: NextApiRequest, res: NextApiResponse) => {
	const apiKey = req.headers["x-ztnet-auth"] as string;

	let decryptedData: { userId: string; name?: string };
	try {
		decryptedData = await decryptAndVerifyToken({ apiKey });
	} catch (error) {
		return res.status(401).json({ error: error.message });
	}

	// If there are users, verify the API key
	const ctx = {
		session: {
			user: {
				id: decryptedData.userId as string,
			},
		},
		prisma,
	};
	try {
		const networks = await prisma.user.findFirst({
			where: {
				id: decryptedData.userId,
			},
			select: {
				network: true,
			},
		});
		const arr = [];
		// biome-ignore lint/correctness/noUnsafeOptionalChaining: <explanation>
		for (const network of networks?.network) {
			const ztControllerResponse = await ztController.local_network_detail(
				//@ts-expect-error
				ctx,
				network.nwid,
				false,
			);
			arr.push(ztControllerResponse.network);
		}

		return res.status(200).json(arr);
	} catch (cause) {
		if (cause instanceof TRPCError) {
			const httpCode = getHTTPStatusCodeFromError(cause);
			try {
				const parsedErrors = JSON.parse(cause.message);
				return res.status(httpCode).json({ cause: parsedErrors });
			} catch (_error) {
				return res.status(httpCode).json({ error: cause.message });
			}
		}
		return res.status(500).json({ message: "Internal server error" });
	}
};
