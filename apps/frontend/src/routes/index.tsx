import { createFileRoute } from "@tanstack/react-router";
import {
	AudioLines,
	BadgeCheck,
	ClipboardList,
	Loader2,
	LogIn,
	LogOut,
	Mic,
	Send,
	ShieldCheck,
	Square,
	UserPlus,
	WalletCards,
} from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export const Route = createFileRoute("/")({ component: App });

const AGENT_URL = "http://127.0.0.1:3001";
const BACKEND_URL = "http://127.0.0.1:3002";

type PreparePaymentResponse = {
	paymentId: string;
	state: string;
	intent: {
		recipientAlias: string;
		recipientAddress?: string;
		amount: string;
		token: string;
		condition?: string;
		reason: string;
		confidence: number;
	};
	policy: {
		status: "APPROVED" | "REQUIRES_REVIEW" | "REJECTED";
		approved: boolean;
		reasons: string[];
		mandateHash?: string;
	};
	intentMandate?: Record<string, unknown>;
	checkoutMandate?: Record<string, unknown>;
	paymentMandate?: Record<string, unknown>;
	confirmationPrompt: string;
};

type VoiceReceiptResponse = {
	text: string;
	model: string;
	audioBase64: string;
	mimeType: string;
	voice: {
		languageCode: string;
		name: string;
	};
};

type VoiceIntrospectionResponse = {
	kind: "payment_processing";
	id: string;
	text: string;
	model: string;
	audioBase64: string;
	mimeType: "audio/mpeg";
	source: "pre-recorded";
	selectedAt: string;
	intent: {
		intent: "payment" | "unknown";
		confidence: number;
		isCommand: boolean;
		entities: {
			amount?: string;
			token?: "USDC" | "USDm";
			recipientAlias?: string;
		};
	};
};

type RequestPayload = {
	transcript: string;
	userWallet: `0x${string}`;
	network: "celo-sepolia";
	allowedTokens: string[];
	merchantAllowlist: Record<string, `0x${string}`>;
	maxAmount: string;
	validMinutes: number;
	idempotencyKey: string;
};

type BackendUser = {
	id: string;
	displayName: string;
	email: string;
	walletAddress: `0x${string}`;
	network: "celo-sepolia" | "celo";
	createdAt: string;
	updatedAt: string;
};

type BackendContact = {
	id: string;
	userId: string;
	alias: string;
	walletAddress: `0x${string}`;
	network: "celo-sepolia" | "celo";
	preferredToken: "USDC" | "USDm";
};

type KeytermsResponse = {
	keytermsPrompt: string[];
	contacts: BackendContact[];
	maxTerms: number;
};

type LoginResponse = {
	user: BackendUser;
	contacts: BackendContact[];
	keyterms: KeytermsResponse;
};

type StreamingTokenResponse = {
	token: string;
	expiresInSeconds: number;
	speechModel: "universal-3-5-pro";
};

type StreamingTurnMessage = {
	type: "Turn";
	transcript?: string;
	end_of_turn?: boolean;
};

function App() {
	const [transcript, setTranscript] = useState(
		"Quiero pagar 0.5 USDC al proveedor autorizado proveedor por la factura demo",
	);
	const [userWallet, setUserWallet] = useState(
		"0x1111111111111111111111111111111111111111",
	);
	const [merchantAlias, setMerchantAlias] = useState("proveedor");
	const [merchantAddress, setMerchantAddress] = useState(
		"0x2222222222222222222222222222222222222222",
	);
	const [maxAmount, setMaxAmount] = useState("10");
	const [displayName, setDisplayName] = useState("Demo User");
	const [email, setEmail] = useState("demo@payproof.local");
	const [password, setPassword] = useState("PayProofDemo2026!");
	const [idempotencyKey, setIdempotencyKey] = useState(
		() => `demo-${Date.now()}`,
	);
	const [payment, setPayment] = useState<PreparePaymentResponse | null>(null);
	const [receipt, setReceipt] = useState<VoiceReceiptResponse | null>(null);
	const [introspection, setIntrospection] =
		useState<VoiceIntrospectionResponse | null>(null);
	const [backendUser, setBackendUser] = useState<BackendUser | null>(null);
	const [contacts, setContacts] = useState<BackendContact[]>([]);
	const [keyterms, setKeyterms] = useState<KeytermsResponse | null>(null);
	const [introspectionWarning, setIntrospectionWarning] = useState<
		string | null
	>(null);
	const [error, setError] = useState<string | null>(null);
	const [backendError, setBackendError] = useState<string | null>(null);
	const [isPreparing, setIsPreparing] = useState(false);
	const [isSpeaking, setIsSpeaking] = useState(false);
	const [isBackendLoading, setIsBackendLoading] = useState(false);
	const [isSessionLoading, setIsSessionLoading] = useState(true);
	const [isLoggingIn, setIsLoggingIn] = useState(false);
	const [isRecording, setIsRecording] = useState(false);
	const [liveTranscript, setLiveTranscript] = useState("");
	const [voiceError, setVoiceError] = useState<string | null>(null);
	const audioContextRef = useRef<AudioContext | null>(null);
	const mediaStreamRef = useRef<MediaStream | null>(null);
	const processorRef = useRef<ScriptProcessorNode | null>(null);
	const websocketRef = useRef<WebSocket | null>(null);

	const applyLoginState = useCallback((body: LoginResponse) => {
		setBackendUser(body.user);
		setContacts(body.contacts);
		setKeyterms(body.keyterms);
		setDisplayName(body.user.displayName);
		setEmail(body.user.email);
		setUserWallet(body.user.walletAddress);
	}, []);

	useEffect(() => {
		const restoreSession = async () => {
			try {
				const response = await fetch(`${BACKEND_URL}/auth/session`, {
					credentials: "include",
				});
				const body = await response.json();

				if (!response.ok) {
					return;
				}

				applyLoginState(body as LoginResponse);
			} catch {
				setBackendError(null);
			} finally {
				setIsSessionLoading(false);
			}
		};

		void restoreSession();
	}, [applyLoginState]);

	const requestPayload = useMemo<RequestPayload>(() => {
		const contactAllowlist = Object.fromEntries(
			contacts.map((contact) => [contact.alias, contact.walletAddress]),
		);

		return {
			transcript,
			userWallet: userWallet as `0x${string}`,
			network: "celo-sepolia",
			allowedTokens: ["USDC", "USDm"],
			merchantAllowlist: {
				...contactAllowlist,
				[merchantAlias]: merchantAddress as `0x${string}`,
			},
			maxAmount,
			validMinutes: 15,
			idempotencyKey,
		};
	}, [
		transcript,
		userWallet,
		merchantAlias,
		merchantAddress,
		maxAmount,
		idempotencyKey,
		contacts,
	]);
	const assemblyAiPayload = useMemo(
		() => ({
			streamingConnectionParams: {
				speech_model: "universal-3-5-pro",
				mode: "balanced",
				language_code: "es",
				sample_rate: 16000,
				encoding: "pcm_s16le",
				format_turns: true,
				keyterms_prompt: keyterms?.keytermsPrompt ?? [],
			},
			asyncTranscribeUrlBody: {
				audioUrl: "https://example.com/payment-order.mp3",
				keytermsPrompt: keyterms?.keytermsPrompt ?? [],
			},
		}),
		[keyterms],
	);

	const preparePayment = async () => {
		setIsPreparing(true);
		setError(null);
		setReceipt(null);
		setIntrospection(null);
		setIntrospectionWarning(null);

		try {
			await requestIntrospection(
				transcript,
				setIntrospection,
				setIntrospectionWarning,
			);

			const response = await fetch(`${AGENT_URL}/payments/prepare`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(requestPayload),
			});
			const body = await response.json();

			if (!response.ok) {
				throw new Error(body.error ?? JSON.stringify(body, null, 2));
			}

			setPayment(body);
		} catch (caught) {
			setPayment(null);
			setError(
				caught instanceof Error
					? caught.message
					: "No se pudo preparar el pago.",
			);
		} finally {
			setIsPreparing(false);
		}
	};

	const generateReceipt = async () => {
		if (!payment) {
			return;
		}

		setIsSpeaking(true);
		setError(null);

		try {
			const response = await fetch(`${AGENT_URL}/voice/receipt`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payment),
			});
			const body = await response.json();

			if (!response.ok) {
				throw new Error(body.error ?? JSON.stringify(body, null, 2));
			}

			setReceipt(body);
		} catch (caught) {
			setError(
				caught instanceof Error
					? caught.message
					: "No se pudo generar el recibo de voz.",
			);
		} finally {
			setIsSpeaking(false);
		}
	};

	const startRecording = async () => {
		setVoiceError(null);
		setLiveTranscript("");

		try {
			const tokenResponse = await fetch(`${AGENT_URL}/voice/streaming-token`, {
				method: "POST",
			});
			const tokenBody = await tokenResponse.json();

			if (!tokenResponse.ok) {
				throw new Error(tokenBody.error ?? JSON.stringify(tokenBody, null, 2));
			}

			const { token, speechModel } = tokenBody as StreamingTokenResponse;
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});
			const audioContext = new AudioContext();
			const source = audioContext.createMediaStreamSource(stream);
			const processor = audioContext.createScriptProcessor(4096, 1, 1);
			const params = new URLSearchParams({
				token,
				speech_model: speechModel,
				mode: "balanced",
				language_code: "es",
				sample_rate: "16000",
				encoding: "pcm_s16le",
				format_turns: "true",
				keyterms_prompt: JSON.stringify(keyterms?.keytermsPrompt ?? []),
			});
			const websocket = new WebSocket(
				`wss://streaming.assemblyai.com/v3/ws?${params.toString()}`,
			);
			websocket.binaryType = "arraybuffer";

			websocket.onmessage = (event) => {
				const message = JSON.parse(String(event.data)) as
					| StreamingTurnMessage
					| { type: string; error?: string };

				if (isStreamingTurnMessage(message) && message.transcript) {
					setLiveTranscript(message.transcript);

					if (message.end_of_turn) {
						setTranscript((current) =>
							[current, message.transcript]
								.filter(Boolean)
								.join(" ")
								.replace(/\s+/g, " ")
								.trim(),
						);
						setLiveTranscript("");
					}
				}

				if ("error" in message && message.error) {
					setVoiceError(message.error);
				}
			};
			websocket.onerror = () => {
				setVoiceError("No se pudo conectar el streaming de AssemblyAI.");
			};
			websocket.onclose = () => {
				setIsRecording(false);
			};
			websocket.onopen = () => {
				processor.onaudioprocess = (event) => {
					if (websocket.readyState !== WebSocket.OPEN) {
						return;
					}

					const input = event.inputBuffer.getChannelData(0);
					const pcm = downsampleTo16BitPcm(
						input,
						audioContext.sampleRate,
						16_000,
					);

					if (pcm.byteLength > 0) {
						websocket.send(pcm);
					}
				};
				source.connect(processor);
				processor.connect(audioContext.destination);
				setIsRecording(true);
			};

			audioContextRef.current = audioContext;
			mediaStreamRef.current = stream;
			processorRef.current = processor;
			websocketRef.current = websocket;
		} catch (caught) {
			await stopRecording();
			setVoiceError(
				caught instanceof Error
					? caught.message
					: "No se pudo iniciar la captura de audio.",
			);
		}
	};
	const stopRecording = async () => {
		processorRef.current?.disconnect();
		processorRef.current = null;

		if (websocketRef.current?.readyState === WebSocket.OPEN) {
			websocketRef.current.send(JSON.stringify({ type: "Terminate" }));
		}
		websocketRef.current?.close();
		websocketRef.current = null;

		for (const track of mediaStreamRef.current?.getTracks() ?? []) {
			track.stop();
		}
		mediaStreamRef.current = null;

		if (audioContextRef.current?.state !== "closed") {
			await audioContextRef.current?.close();
		}
		audioContextRef.current = null;
		setIsRecording(false);
	};

	const resetIdempotency = () => setIdempotencyKey(`demo-${Date.now()}`);
	const login = async () => {
		setIsLoggingIn(true);
		setBackendError(null);

		try {
			const response = await fetch(`${BACKEND_URL}/auth/login`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({ email, password }),
			});
			const body = await response.json();

			if (!response.ok) {
				throw new Error(body.error ?? JSON.stringify(body, null, 2));
			}

			applyLoginState(body as LoginResponse);
		} catch (caught) {
			setBackendError(
				caught instanceof Error ? caught.message : "No se pudo iniciar sesion.",
			);
		} finally {
			setIsLoggingIn(false);
		}
	};
	const logout = async () => {
		await stopRecording();
		await fetch(`${BACKEND_URL}/auth/logout`, {
			method: "POST",
			credentials: "include",
		}).catch(() => undefined);
		setBackendUser(null);
		setContacts([]);
		setKeyterms(null);
		setPayment(null);
		setReceipt(null);
		setIntrospection(null);
	};
	const createAccount = async () => {
		setIsBackendLoading(true);
		setBackendError(null);

		try {
			const response = await fetch(`${BACKEND_URL}/accounts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				credentials: "include",
				body: JSON.stringify({
					displayName,
					email,
					password,
					walletAddress: userWallet,
					network: "celo-sepolia",
				}),
			});
			const body = await response.json();

			if (!response.ok) {
				throw new Error(body.error ?? JSON.stringify(body, null, 2));
			}

			setBackendUser(body.user);
			await refreshContactsAndKeyterms(body.user.id);
		} catch (caught) {
			setBackendError(
				caught instanceof Error
					? caught.message
					: "No se pudo crear o consultar la cuenta.",
			);
		} finally {
			setIsBackendLoading(false);
		}
	};
	const saveContact = async () => {
		if (!backendUser) {
			setBackendError("Crea o consulta una cuenta antes de guardar contactos.");
			return;
		}

		setIsBackendLoading(true);
		setBackendError(null);

		try {
			const response = await fetch(
				`${BACKEND_URL}/users/${backendUser.id}/contacts`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						alias: merchantAlias,
						walletAddress: merchantAddress,
						network: "celo-sepolia",
						preferredToken: "USDC",
					}),
				},
			);
			const body = await response.json();

			if (!response.ok) {
				throw new Error(body.error ?? JSON.stringify(body, null, 2));
			}

			await refreshContactsAndKeyterms(backendUser.id);
		} catch (caught) {
			setBackendError(
				caught instanceof Error
					? caught.message
					: "No se pudo guardar el contacto.",
			);
		} finally {
			setIsBackendLoading(false);
		}
	};
	const refreshContactsAndKeyterms = async (userId: string) => {
		const [contactsResponse, keytermsResponse] = await Promise.all([
			fetch(`${BACKEND_URL}/users/${userId}/contacts`, {
				credentials: "include",
			}),
			fetch(`${BACKEND_URL}/users/${userId}/assemblyai-keyterms`, {
				credentials: "include",
			}),
		]);
		const contactsBody = await contactsResponse.json();
		const keytermsBody = await keytermsResponse.json();

		if (!contactsResponse.ok) {
			throw new Error(
				contactsBody.error ?? JSON.stringify(contactsBody, null, 2),
			);
		}
		if (!keytermsResponse.ok) {
			throw new Error(
				keytermsBody.error ?? JSON.stringify(keytermsBody, null, 2),
			);
		}

		setContacts(contactsBody.contacts);
		setKeyterms(keytermsBody);
	};
	const policyTone = getPolicyTone(payment?.policy.status);

	if (!backendUser) {
		return (
			<LoginScreen
				backendError={backendError}
				email={email}
				isLoading={isSessionLoading || isLoggingIn}
				onEmailChange={setEmail}
				onLogin={login}
				onPasswordChange={setPassword}
				password={password}
			/>
		);
	}

	return (
		<main className="min-h-screen bg-zinc-100 text-zinc-950">
			<section className="border-b border-zinc-200 bg-white">
				<div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
					<div>
						<p className="text-sm font-semibold text-emerald-700">PayProof</p>
						<h1 className="mt-1 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">
							Voice agent de pagos
						</h1>
						<p className="mt-1 text-sm text-zinc-600">
							Captura voz, resuelve aliases, prepara el mandato y genera recibo
							de audio.
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						<StatusPill label="Agent" value={AGENT_URL} />
						<StatusPill label="Backend" value={BACKEND_URL} />
						<button
							className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
							onClick={logout}
							type="button"
						>
							<LogOut className="h-4 w-4" />
							Salir
						</button>
					</div>
				</div>
			</section>

			<section className="mx-auto grid max-w-7xl gap-5 px-5 py-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
				<div className="space-y-5">
					<div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
						<SectionHeader
							icon={<AudioLines className="h-5 w-5 text-emerald-700" />}
							kicker="Paso 1"
							title="Orden por voz"
						/>

						<div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4">
							<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<p className="text-sm font-semibold text-zinc-950">
										Micrófono en vivo
									</p>
									<p className="mt-1 text-sm text-zinc-600">
										AssemblyAI escucha y vuelca el texto final a la
										transcripción.
									</p>
								</div>
								<button
									className={`inline-flex h-10 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-zinc-400 ${
										isRecording
											? "bg-red-700 text-white hover:bg-red-800"
											: "bg-zinc-950 text-white hover:bg-zinc-800"
									}`}
									onClick={() =>
										isRecording ? void stopRecording() : void startRecording()
									}
									type="button"
								>
									{isRecording ? (
										<Square className="h-4 w-4" />
									) : (
										<Mic className="h-4 w-4" />
									)}
									{isRecording ? "Detener" : "Capturar audio"}
								</button>
							</div>

							{liveTranscript ? (
								<p className="mt-3 rounded-md border border-sky-200 bg-white px-3 py-2 text-sm text-sky-900">
									{liveTranscript}
								</p>
							) : null}

							{voiceError ? (
								<div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
									{voiceError}
								</div>
							) : null}
						</div>

						<label
							className="mt-4 block text-sm font-medium text-zinc-700"
							htmlFor="transcript"
						>
							Transcripción editable
						</label>
						<textarea
							className="mt-2 min-h-36 w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
							id="transcript"
							onChange={(event) => setTranscript(event.target.value)}
							value={transcript}
						/>

						<div className="mt-4 grid gap-3 sm:grid-cols-2">
							<Field
								label="Alias destinatario"
								onChange={setMerchantAlias}
								value={merchantAlias}
							/>
							<Field
								label="Monto máximo autorizado"
								onChange={setMaxAmount}
								value={maxAmount}
							/>
							<Field
								label="Wallet usuario"
								onChange={setUserWallet}
								value={userWallet}
							/>
							<Field
								label="Wallet destinatario"
								onChange={setMerchantAddress}
								value={merchantAddress}
							/>
						</div>

						<div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
							<label
								className="block text-sm font-medium text-zinc-700"
								htmlFor="idempotency"
							>
								Idempotency key
								<input
									className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
									id="idempotency"
									onChange={(event) => setIdempotencyKey(event.target.value)}
									value={idempotencyKey}
								/>
							</label>
							<button
								className="mt-auto inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
								onClick={resetIdempotency}
								type="button"
							>
								Nueva
							</button>
						</div>

						<button
							className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
							disabled={isPreparing}
							onClick={preparePayment}
							type="button"
						>
							{isPreparing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<Send className="h-4 w-4" />
							)}
							Preparar pago
						</button>
					</div>

					<div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
						<div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<SectionHeader
								icon={<ClipboardList className="h-5 w-5 text-emerald-700" />}
								kicker="Paso 2"
								title="Resultado del agente"
							/>
							{payment ? (
								<span
									className={`inline-flex w-fit rounded-md px-2.5 py-1 text-xs font-semibold ${policyTone}`}
								>
									{payment.policy.status}
								</span>
							) : null}
						</div>

						{error ? (
							<div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
								{error}
							</div>
						) : null}

						{introspectionWarning ? (
							<div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
								{introspectionWarning}
							</div>
						) : null}

						{introspection ? (
							<div className="mb-4 rounded-md border border-sky-200 bg-sky-50 p-3">
								<div className="flex items-start gap-2 text-sm text-sky-950">
									<AudioLines className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" />
									<div>
										<p className="font-semibold">
											Respuesta inicial del agente
										</p>
										<p className="mt-1">{introspection.text}</p>
										<p className="mt-1 text-xs text-sky-800">
											Intención preliminar: {introspection.intent.intent} /{" "}
											{Math.round(introspection.intent.confidence * 100)}%
										</p>
									</div>
								</div>
								<audio
									className="mt-3 w-full"
									controls
									src={`data:${introspection.mimeType};base64,${introspection.audioBase64}`}
								>
									<track kind="captions" />
								</audio>
							</div>
						) : null}

						{payment ? (
							<div className="grid gap-3 md:grid-cols-3">
								<Metric label="Estado" value={payment.state} />
								<Metric
									label="Monto"
									value={`${payment.intent.amount} ${payment.intent.token}`}
								/>
								<Metric
									label="Confianza"
									value={`${Math.round(payment.intent.confidence * 100)}%`}
								/>
								<Metric
									label="Destinatario"
									value={payment.intent.recipientAlias}
								/>
								<Metric label="Payment ID" value={payment.paymentId} />
								<Metric label="Razón" value={payment.intent.reason} />
							</div>
						) : (
							<div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-600">
								El resultado aparecerá después de preparar el pago.
							</div>
						)}

						{payment ? (
							<div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3">
								<div className="flex items-start gap-2 text-sm text-emerald-950">
									<BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
									<p>{payment.confirmationPrompt}</p>
								</div>
								<button
									className="mt-3 inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
									disabled={isSpeaking}
									onClick={generateReceipt}
									type="button"
								>
									{isSpeaking ? (
										<Loader2 className="h-4 w-4 animate-spin" />
									) : (
										<AudioLines className="h-4 w-4" />
									)}
									Generar TTS
								</button>
							</div>
						) : null}
					</div>

					{receipt ? (
						<div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
							<SectionHeader
								icon={<AudioLines className="h-5 w-5 text-emerald-700" />}
								kicker="Audio"
								title="Recibo de voz"
							/>
							<p className="mt-3 text-sm text-zinc-700">{receipt.text}</p>
							<audio
								className="mt-3 w-full"
								controls
								src={`data:${receipt.mimeType};base64,${receipt.audioBase64}`}
							>
								<track kind="captions" />
							</audio>
							<p className="mt-2 text-xs text-zinc-500">
								{receipt.model} / {receipt.voice.name}
							</p>
						</div>
					) : null}
				</div>

				<aside className="space-y-5 lg:sticky lg:top-5 lg:self-start">
					<div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
						<SectionHeader
							icon={<UserPlus className="h-5 w-5 text-emerald-700" />}
							kicker="Cuenta"
							title={backendUser.displayName}
						/>

						<div className="mt-4 space-y-3">
							<Field
								label="Nombre usuario"
								onChange={setDisplayName}
								value={displayName}
							/>
							<Field label="Email" onChange={setEmail} value={email} />
						</div>

						<div className="mt-4 grid gap-2">
							<button
								className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
								disabled={isBackendLoading}
								onClick={createAccount}
								type="button"
							>
								{isBackendLoading ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									<UserPlus className="h-4 w-4" />
								)}
								Actualizar cuenta
							</button>
							<button
								className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:cursor-not-allowed disabled:text-zinc-400"
								disabled={isBackendLoading || !backendUser}
								onClick={saveContact}
								type="button"
							>
								Guardar alias actual
							</button>
						</div>

						{backendError ? (
							<div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
								{backendError}
							</div>
						) : null}

						<div className="mt-4 grid gap-3">
							<Metric label="Usuario backend" value={backendUser.id} />
							<Metric
								label="Aliases"
								value={
									contacts.map((contact) => contact.alias).join(", ") || "0"
								}
							/>
						</div>
					</div>

					<PayloadBlock
						title="DTO enviado a /payments/prepare"
						value={requestPayload}
					/>
					<PayloadBlock
						title="DTO AssemblyAI KeyTerms"
						value={assemblyAiPayload}
					/>
					<PayloadBlock
						title="DTO recibido desde /voice/introspection"
						value={introspection}
					/>
					<PayloadBlock
						title="DTO recibido desde /payments/prepare"
						value={payment}
					/>
				</aside>
			</section>
		</main>
	);
}

function LoginScreen(props: {
	backendError: string | null;
	email: string;
	isLoading: boolean;
	onEmailChange: (value: string) => void;
	onLogin: () => Promise<void>;
	onPasswordChange: (value: string) => void;
	password: string;
}) {
	return (
		<main className="min-h-screen bg-zinc-50 text-zinc-950">
			<section className="border-b border-zinc-200 bg-white">
				<div className="mx-auto grid min-h-[calc(100vh-1px)] max-w-7xl content-center gap-8 px-5 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
					<div className="max-w-2xl">
						<div className="mb-5 inline-flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
							<ShieldCheck className="h-4 w-4" />
							PayProof Voice Agent
						</div>
						<h1 className="text-4xl font-semibold tracking-normal text-zinc-950 sm:text-5xl">
							Pagos preparados por voz con evidencia operativa
						</h1>
						<p className="mt-5 max-w-xl text-base leading-7 text-zinc-600">
							PayProof transforma instrucciones habladas en payloads auditables
							para aprobacion onchain. La IA detecta intencion, el backend
							resuelve usuarios y aliases, y la capa de politica deja el pago
							listo sin mover fondos hasta la confirmacion.
						</p>
						<div className="mt-6 grid gap-3 sm:grid-cols-3">
							<Metric label="IA" value="Intent + TTS" />
							<Metric label="Sesion" value="Redis" />
							<Metric label="Red" value="Celo Sepolia" />
						</div>
					</div>

					<form
						className="rounded-lg border border-zinc-200 bg-zinc-50 p-5 shadow-sm"
						onSubmit={(event) => {
							event.preventDefault();
							void props.onLogin();
						}}
					>
						<div className="mb-5 flex items-center gap-2">
							<WalletCards className="h-5 w-5 text-emerald-700" />
							<h2 className="text-lg font-semibold">Ingreso demo</h2>
						</div>

						<Field
							label="Email"
							onChange={props.onEmailChange}
							value={props.email}
						/>
						<label className="mt-3 block text-sm font-medium text-zinc-700">
							Password
							<input
								className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
								onChange={(event) => props.onPasswordChange(event.target.value)}
								type="password"
								value={props.password}
							/>
						</label>

						{props.backendError ? (
							<div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
								{props.backendError}
							</div>
						) : null}

						<button
							className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
							disabled={props.isLoading}
							type="submit"
						>
							{props.isLoading ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : (
								<LogIn className="h-4 w-4" />
							)}
							Entrar a la consola
						</button>

						<div className="mt-5 rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-700">
							<p className="font-medium text-zinc-950">Cuenta seeded</p>
							<p className="mt-1 break-all">{props.email}</p>
						</div>
					</form>
				</div>
			</section>
		</main>
	);
}

async function requestIntrospection(
	transcript: string,
	onSuccess: (value: VoiceIntrospectionResponse) => void,
	onWarning: (value: string) => void,
) {
	try {
		const response = await fetch(`${AGENT_URL}/voice/introspection`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ transcript }),
		});
		const body = await response.json();

		if (!response.ok) {
			throw new Error(body.error ?? JSON.stringify(body, null, 2));
		}

		onSuccess(body);
		void new Audio(`data:${body.mimeType};base64,${body.audioBase64}`)
			.play()
			.catch(() => undefined);
	} catch (caught) {
		onWarning(
			caught instanceof Error
				? caught.message
				: "No se pudo reproducir el audio pregrabado.",
		);
	}
}

function downsampleTo16BitPcm(
	input: Float32Array,
	inputSampleRate: number,
	outputSampleRate: number,
): ArrayBuffer {
	if (outputSampleRate === inputSampleRate) {
		return floatTo16BitPcm(input);
	}

	const ratio = inputSampleRate / outputSampleRate;
	const outputLength = Math.floor(input.length / ratio);
	const output = new Float32Array(outputLength);

	for (let index = 0; index < outputLength; index += 1) {
		const start = Math.floor(index * ratio);
		const end = Math.min(Math.floor((index + 1) * ratio), input.length);
		let sum = 0;

		for (let sample = start; sample < end; sample += 1) {
			sum += input[sample] ?? 0;
		}

		output[index] = sum / Math.max(end - start, 1);
	}

	return floatTo16BitPcm(output);
}

function floatTo16BitPcm(input: Float32Array): ArrayBuffer {
	const buffer = new ArrayBuffer(input.length * 2);
	const view = new DataView(buffer);

	for (let index = 0; index < input.length; index += 1) {
		const sample = Math.max(-1, Math.min(1, input[index] ?? 0));
		view.setInt16(
			index * 2,
			sample < 0 ? sample * 0x8000 : sample * 0x7fff,
			true,
		);
	}

	return buffer;
}

function isStreamingTurnMessage(
	message: StreamingTurnMessage | { type: string; error?: string },
): message is StreamingTurnMessage {
	return message.type === "Turn";
}

function Field(props: {
	label: string;
	onChange: (value: string) => void;
	value: string;
}) {
	return (
		<label className="block text-sm font-medium text-zinc-700">
			{props.label}
			<input
				className="mt-2 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
				onChange={(event) => props.onChange(event.target.value)}
				value={props.value}
			/>
		</label>
	);
}

function SectionHeader(props: {
	icon: ReactNode;
	kicker: string;
	title: string;
}) {
	return (
		<div className="flex items-center gap-3">
			<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-emerald-50">
				{props.icon}
			</div>
			<div>
				<p className="text-xs font-semibold uppercase text-emerald-700">
					{props.kicker}
				</p>
				<h2 className="text-lg font-semibold text-zinc-950">{props.title}</h2>
			</div>
		</div>
	);
}

function StatusPill(props: { label: string; value: string }) {
	return (
		<div className="flex h-9 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-xs text-zinc-700">
			<ShieldCheck className="h-4 w-4 text-emerald-700" />
			<span className="font-semibold text-zinc-900">{props.label}</span>
			<span className="hidden max-w-48 truncate sm:inline">{props.value}</span>
		</div>
	);
}

function Metric(props: { label: string; value: string }) {
	return (
		<div className="rounded-md border border-zinc-200 bg-zinc-50 p-3">
			<p className="text-xs font-medium uppercase text-zinc-500">
				{props.label}
			</p>
			<p className="mt-1 break-words text-sm font-semibold text-zinc-950">
				{props.value}
			</p>
		</div>
	);
}

function PayloadBlock(props: { title: string; value: unknown }) {
	return (
		<details className="group rounded-lg border border-zinc-200 bg-zinc-950 shadow-sm">
			<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-zinc-100">
				{props.title}
				<span className="text-xs font-medium text-zinc-400 group-open:hidden">
					Ver
				</span>
				<span className="hidden text-xs font-medium text-zinc-400 group-open:inline">
					Ocultar
				</span>
			</summary>
			<pre className="max-h-[360px] overflow-auto border-t border-zinc-800 bg-black p-3 text-xs leading-relaxed text-emerald-100">
				{JSON.stringify(props.value, null, 2)}
			</pre>
		</details>
	);
}

function getPolicyTone(status?: string) {
	if (status === "APPROVED") {
		return "bg-emerald-100 text-emerald-800";
	}
	if (status === "REQUIRES_REVIEW") {
		return "bg-amber-100 text-amber-800";
	}
	if (status === "REJECTED") {
		return "bg-red-100 text-red-800";
	}
	return "bg-zinc-100 text-zinc-700";
}
