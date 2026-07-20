create table if not exists payproof_payment_preparations (
	id text primary key,
	payment_id text not null unique,
	user_id text not null references payproof_users(id) on delete cascade,
	user_wallet text not null,
	network text not null,
	chain_id integer not null,
	token_symbol text not null,
	token_address text not null,
	token_decimals integer not null,
	recipient_address text not null,
	amount_base_units text not null,
	amount_display text not null,
	idempotency_key text,
	request_hash text not null,
	mandate_hash text unique,
	contract_address text,
	policy_decision jsonb not null,
	state text not null,
	response_json jsonb not null,
	expires_at timestamptz not null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint payproof_payment_preparations_user_wallet_format check (
		user_wallet ~ '^0x[a-fA-F0-9]{40}$'
	),
	constraint payproof_payment_preparations_token_address_format check (
		token_address ~ '^0x[a-fA-F0-9]{40}$'
	),
	constraint payproof_payment_preparations_recipient_address_format check (
		recipient_address ~ '^0x[a-fA-F0-9]{40}$'
	),
	constraint payproof_payment_preparations_contract_address_format check (
		contract_address is null or contract_address ~ '^0x[a-fA-F0-9]{40}$'
	),
	constraint payproof_payment_preparations_network_check check (
		network in ('celo-sepolia', 'celo')
	),
	constraint payproof_payment_preparations_token_check check (
		token_symbol in ('USDC', 'USDm')
	),
	constraint payproof_payment_preparations_amount_positive check (
		amount_base_units ~ '^[0-9]+$' and amount_base_units <> '0'
	),
	constraint payproof_payment_preparations_chain_positive check (
		chain_id > 0
	),
	constraint payproof_payment_preparations_decimals_positive check (
		token_decimals > 0
	)
);

create unique index if not exists payproof_payment_preparations_idempotency_idx
	on payproof_payment_preparations (lower(user_wallet), idempotency_key)
	where idempotency_key is not null;

create index if not exists payproof_payment_preparations_user_id_idx
	on payproof_payment_preparations (user_id, created_at desc);

create table if not exists payproof_payment_transactions (
	id text primary key,
	payment_id text not null references payproof_payment_preparations(payment_id) on delete cascade,
	tx_hash text not null unique,
	chain_id integer not null,
	contract_address text not null,
	from_address text not null,
	to_address text not null,
	status text not null,
	block_number numeric,
	block_hash text,
	confirmations integer,
	error_code text,
	error_message text,
	submitted_at timestamptz not null default now(),
	confirmed_at timestamptz,
	constraint payproof_payment_transactions_tx_hash_format check (
		tx_hash ~ '^0x[a-fA-F0-9]+$'
	),
	constraint payproof_payment_transactions_contract_address_format check (
		contract_address ~ '^0x[a-fA-F0-9]{40}$'
	),
	constraint payproof_payment_transactions_from_address_format check (
		from_address ~ '^0x[a-fA-F0-9]{40}$'
	),
	constraint payproof_payment_transactions_to_address_format check (
		to_address ~ '^0x[a-fA-F0-9]{40}$'
	),
	constraint payproof_payment_transactions_status_check check (
		status in ('submitting', 'submitted', 'confirmed', 'failed', 'reorged')
	)
);

create index if not exists payproof_payment_transactions_payment_id_idx
	on payproof_payment_transactions (payment_id);

create table if not exists payproof_payment_events (
	id text primary key,
	payment_id text not null,
	user_id text not null,
	event_type text not null,
	payload_json jsonb not null,
	created_at timestamptz not null default now()
);

create index if not exists payproof_payment_events_payment_id_idx
	on payproof_payment_events (payment_id, created_at asc);

create table if not exists payproof_chain_event_logs (
	id text primary key,
	chain_id integer not null,
	contract_address text not null,
	tx_hash text not null,
	log_index integer not null,
	block_number numeric not null,
	block_hash text not null,
	event_name text not null,
	payment_id text,
	payload_json jsonb not null,
	removed boolean not null default false,
	observed_at timestamptz not null default now(),
	confirmed_at timestamptz,
	constraint payproof_chain_event_logs_unique_log unique (
		chain_id,
		tx_hash,
		log_index
	)
);

create table if not exists payproof_chain_indexer_cursors (
	chain_id integer not null,
	contract_address text not null,
	last_scanned_block numeric not null,
	last_scanned_block_hash text not null,
	updated_at timestamptz not null default now(),
	primary key (chain_id, contract_address)
);

create unique index if not exists payproof_chain_indexer_cursors_lower_idx
	on payproof_chain_indexer_cursors (chain_id, lower(contract_address));

create table if not exists payproof_realtime_events (
	event_id text primary key,
	user_id text not null,
	aggregate_id text not null,
	event_type text not null,
	payload_json jsonb not null,
	created_at timestamptz not null default now(),
	expires_at timestamptz not null
);

create index if not exists payproof_realtime_events_user_created_idx
	on payproof_realtime_events (user_id, created_at asc);

create table if not exists payproof_outbox_events (
	id text primary key,
	event_id text not null unique,
	user_id text not null,
	aggregate_id text not null,
	event_type text not null,
	payload_json jsonb not null,
	status text not null default 'pending',
	attempts integer not null default 0,
	available_at timestamptz not null default now(),
	published_at timestamptz,
	created_at timestamptz not null default now(),
	constraint payproof_outbox_events_status_check check (
		status in ('pending', 'published', 'failed')
	)
);

create index if not exists payproof_outbox_events_pending_idx
	on payproof_outbox_events (status, available_at asc);
