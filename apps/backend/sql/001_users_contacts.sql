create table if not exists payproof_users (
	id text primary key,
	display_name text not null,
	email text not null,
	password_hash text not null,
	wallet_address text not null,
	network text not null default 'celo-sepolia',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint payproof_users_wallet_address_format check (
		wallet_address ~ '^0x[a-fA-F0-9]{40}$'
	),
	constraint payproof_users_network_check check (
		network in ('celo-sepolia', 'celo')
	)
);

alter table if exists payproof_users
	add column if not exists email text;

alter table if exists payproof_users
	add column if not exists password_hash text;

update payproof_users
set email = id || '@payproof.local'
where email is null;

update payproof_users
set password_hash = 'scrypt$16384$8$1$da71f1d02d974f6e67719ffa42e15fac$31c8a7eaa13b2fa52f24c908436eebb0049080bd1c93e89f369e38b848b61f7f64df3b2ef5158750944492b0c6ec8ea2d63e35ea6bea843a1a014badbbec431b'
where password_hash is null;

alter table if exists payproof_users
	alter column email set not null;

alter table if exists payproof_users
	alter column password_hash set not null;

create unique index if not exists payproof_users_wallet_unique_idx
	on payproof_users (lower(wallet_address));

create unique index if not exists payproof_users_email_unique_idx
	on payproof_users (lower(email));

create table if not exists payproof_contacts (
	id text primary key,
	user_id text not null references payproof_users(id) on delete cascade,
	alias text not null,
	wallet_address text not null,
	network text not null default 'celo-sepolia',
	preferred_token text not null default 'USDC',
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	constraint payproof_contacts_alias_not_blank check (
		length(trim(alias)) > 0
	),
	constraint payproof_contacts_wallet_address_format check (
		wallet_address ~ '^0x[a-fA-F0-9]{40}$'
	),
	constraint payproof_contacts_network_check check (
		network in ('celo-sepolia', 'celo')
	),
	constraint payproof_contacts_preferred_token_check check (
		preferred_token in ('USDC', 'USDm')
	)
);

create unique index if not exists payproof_contacts_user_alias_unique_idx
	on payproof_contacts (user_id, lower(alias));

create index if not exists payproof_contacts_user_id_idx
	on payproof_contacts (user_id);

insert into payproof_users (
	id,
	display_name,
	email,
	password_hash,
	wallet_address,
	network
)
values (
	'demo_user',
	'PayProof Demo',
	'demo@payproof.local',
	'scrypt$16384$8$1$da71f1d02d974f6e67719ffa42e15fac$31c8a7eaa13b2fa52f24c908436eebb0049080bd1c93e89f369e38b848b61f7f64df3b2ef5158750944492b0c6ec8ea2d63e35ea6bea843a1a014badbbec431b',
	'0x1111111111111111111111111111111111111111',
	'celo-sepolia'
)
on conflict (id) do update
set
	display_name = excluded.display_name,
	email = excluded.email,
	password_hash = excluded.password_hash,
	wallet_address = excluded.wallet_address,
	network = excluded.network,
	updated_at = now();

insert into payproof_contacts (
	id,
	user_id,
	alias,
	wallet_address,
	network,
	preferred_token
)
values
	(
		'demo_contact_proveedor',
		'demo_user',
		'proveedor',
		'0x2222222222222222222222222222222222222222',
		'celo-sepolia',
		'USDC'
	),
	(
		'demo_contact_tesoreria',
		'demo_user',
		'tesoreria',
		'0x3333333333333333333333333333333333333333',
		'celo-sepolia',
		'USDC'
	)
on conflict (id) do update
set
	alias = excluded.alias,
	wallet_address = excluded.wallet_address,
	network = excluded.network,
	preferred_token = excluded.preferred_token,
	updated_at = now();
