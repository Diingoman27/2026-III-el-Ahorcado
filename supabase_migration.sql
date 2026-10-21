-- =============================================================================
-- SCRIPT SQL DESDE CERO PARA SUPABASE (EL AHORCADO - DJANGO)
-- Proyecto: https://vhsqyvppeljmbpizzyjp.supabase.co
-- Independiente de cualquier base de datos anterior
-- =============================================================================

BEGIN;

-- 1. TABLAS DEL SISTEMA DJANGO Y MÓDULO CRUD DE PERMISOS
CREATE TABLE IF NOT EXISTS django_migrations (
    id SERIAL PRIMARY KEY,
    app VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    applied TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS django_content_type (
    id SERIAL PRIMARY KEY,
    app_label VARCHAR(100) NOT NULL,
    model VARCHAR(100) NOT NULL,
    CONSTRAINT django_content_type_app_label_model_76bd3d3b_uniq UNIQUE (app_label, model)
);

CREATE TABLE IF NOT EXISTS auth_permission (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content_type_id INTEGER NOT NULL REFERENCES django_content_type(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    codename VARCHAR(100) NOT NULL,
    CONSTRAINT auth_permission_content_type_id_codename_01ab375a_uniq UNIQUE (content_type_id, codename)
);

CREATE TABLE IF NOT EXISTS auth_group (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS auth_group_permissions (
    id BIGSERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT auth_group_permissions_group_id_permission_id_0cd325b0_uniq UNIQUE (group_id, permission_id)
);

CREATE TABLE IF NOT EXISTS auth_user (
    id SERIAL PRIMARY KEY,
    password VARCHAR(128) NOT NULL,
    last_login TIMESTAMPTZ NULL,
    is_superuser BOOLEAN NOT NULL DEFAULT FALSE,
    username VARCHAR(150) NOT NULL UNIQUE,
    first_name VARCHAR(150) NOT NULL DEFAULT '',
    last_name VARCHAR(150) NOT NULL DEFAULT '',
    email VARCHAR(254) NOT NULL DEFAULT '',
    is_staff BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    date_joined TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth_user_groups (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    group_id INTEGER NOT NULL REFERENCES auth_group(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT auth_user_groups_user_id_group_id_94350c0c_uniq UNIQUE (user_id, group_id)
);

CREATE TABLE IF NOT EXISTS auth_user_user_permissions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    permission_id INTEGER NOT NULL REFERENCES auth_permission(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT auth_user_user_permissions_user_id_permission_id_14a6b632_uniq UNIQUE (user_id, permission_id)
);

CREATE TABLE IF NOT EXISTS django_session (
    session_key VARCHAR(40) PRIMARY KEY,
    session_data TEXT NOT NULL,
    expire_date TIMESTAMPTZ NOT NULL
);

-- 2. TABLAS DEL JUEGO EL AHORCADO
CREATE TABLE IF NOT EXISTS players (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(200) NOT NULL DEFAULT '',
    role VARCHAR(10) NOT NULL DEFAULT 'student',
    score INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS words (
    id SERIAL PRIMARY KEY,
    word TEXT NOT NULL UNIQUE,
    difficulty VARCHAR(10) NOT NULL,
    theme VARCHAR(50) NOT NULL DEFAULT 'General',
    created_by INTEGER NULL REFERENCES players(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assigned_games (
    id SERIAL PRIMARY KEY,
    theme VARCHAR(50) NOT NULL DEFAULT 'General',
    difficulty VARCHAR(10) NOT NULL,
    word_ids INTEGER[] NOT NULL DEFAULT '{}',
    current_index INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(12) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    student_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    teacher_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS daily_words (
    id SERIAL PRIMARY KEY,
    set_date DATE NOT NULL DEFAULT CURRENT_DATE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    set_by INTEGER NULL REFERENCES players(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS games (
    id SERIAL PRIMARY KEY,
    difficulty VARCHAR(10) NOT NULL,
    guessed TEXT[] NOT NULL DEFAULT '{}',
    wrong TEXT[] NOT NULL DEFAULT '{}',
    wrong_attempts INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(10) NOT NULL DEFAULT 'playing',
    revealed_hint VARCHAR(1) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ NULL,
    assigned_game_id INTEGER NULL REFERENCES assigned_games(id) ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    word_id INTEGER NOT NULL REFERENCES words(id) ON DELETE RESTRICT DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS daily_word_answers (
    id SERIAL PRIMARY KEY,
    answer_letter VARCHAR(1) NOT NULL,
    response_time_ms INTEGER NOT NULL,
    points_earned INTEGER NOT NULL DEFAULT 0,
    is_correct BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    daily_word_id INTEGER NOT NULL REFERENCES daily_words(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE DEFERRABLE INITIALLY DEFERRED,
    CONSTRAINT daily_answer_unique UNIQUE (daily_word_id, player_id)
);

-- 3. TIPOS DE CONTENIDO BASE (django_content_type)
INSERT INTO django_content_type (id, app_label, model) VALUES
    (1, 'auth', 'permission'),
    (2, 'auth', 'group'),
    (3, 'auth', 'user'),
    (4, 'contenttypes', 'contenttype'),
    (5, 'sessions', 'session'),
    (6, 'core', 'player'),
    (7, 'core', 'word'),
    (8, 'core', 'assignedgame'),
    (9, 'core', 'dailyword'),
    (10, 'core', 'game'),
    (11, 'core', 'dailywordanswer')
ON CONFLICT (app_label, model) DO NOTHING;

-- 4. PERMISOS INICIALES DEL SISTEMA (auth_permission)
INSERT INTO auth_permission (id, name, content_type_id, codename) VALUES
    (1, 'Can add permission', 1, 'add_permission'),
    (2, 'Can change permission', 1, 'change_permission'),
    (3, 'Can delete permission', 1, 'delete_permission'),
    (4, 'Can view permission', 1, 'view_permission'),
    (5, 'Can add group', 2, 'add_group'),
    (6, 'Can change group', 2, 'change_group'),
    (7, 'Can delete group', 2, 'delete_group'),
    (8, 'Can view group', 2, 'view_group'),
    (9, 'Can add user', 3, 'add_user'),
    (10, 'Can change user', 3, 'change_user'),
    (11, 'Can delete user', 3, 'delete_user'),
    (12, 'Can view user', 3, 'view_user'),
    (13, 'Can add content type', 4, 'add_contenttype'),
    (14, 'Can change content type', 4, 'change_contenttype'),
    (15, 'Can delete content type', 4, 'delete_contenttype'),
    (16, 'Can view content type', 4, 'view_contenttype'),
    (17, 'Can add session', 5, 'add_session'),
    (18, 'Can change session', 5, 'change_session'),
    (19, 'Can delete session', 5, 'delete_session'),
    (20, 'Can view session', 5, 'view_session'),
    (21, 'Can add player', 6, 'add_player'),
    (22, 'Can change player', 6, 'change_player'),
    (23, 'Can delete player', 6, 'delete_player'),
    (24, 'Can view player', 6, 'view_player'),
    (25, 'Can add word', 7, 'add_word'),
    (26, 'Can change word', 7, 'change_word'),
    (27, 'Can delete word', 7, 'delete_word'),
    (28, 'Can view word', 7, 'view_word'),
    (29, 'Can add assigned game', 8, 'add_assignedgame'),
    (30, 'Can change assigned game', 8, 'change_assignedgame'),
    (31, 'Can delete assigned game', 8, 'delete_assignedgame'),
    (32, 'Can view assigned game', 8, 'view_assignedgame'),
    (33, 'Can add daily word', 9, 'add_dailyword'),
    (34, 'Can change daily word', 9, 'change_dailyword'),
    (35, 'Can delete daily word', 9, 'delete_dailyword'),
    (36, 'Can view daily word', 9, 'view_dailyword'),
    (37, 'Can add game', 10, 'add_game'),
    (38, 'Can change game', 10, 'change_game'),
    (39, 'Can delete game', 10, 'delete_game'),
    (40, 'Can view game', 10, 'view_game'),
    (41, 'Can add daily word answer', 11, 'add_dailywordanswer'),
    (42, 'Can change daily word answer', 11, 'change_dailywordanswer'),
    (43, 'Can delete daily word answer', 11, 'delete_dailywordanswer'),
    (44, 'Can view daily word answer', 11, 'view_dailywordanswer')
ON CONFLICT (content_type_id, codename) DO NOTHING;

-- 5. BANCO INICIAL DE PALABRAS (words)
INSERT INTO words (word, difficulty, theme) VALUES
    ('gato', 'easy', 'General'),
    ('casa', 'easy', 'General'),
    ('sol', 'easy', 'General'),
    ('papel', 'easy', 'General'),
    ('raton', 'easy', 'General'),
    ('muerte', 'medium', 'General'),
    ('traicion', 'medium', 'General'),
    ('fantasma', 'medium', 'General'),
    ('laberinto', 'medium', 'General'),
    ('vampiro', 'medium', 'General'),
    ('espionaje', 'hard', 'General'),
    ('conspiracion', 'hard', 'General'),
    ('enigmatico', 'hard', 'General'),
    ('venganza', 'hard', 'General'),
    ('masacre', 'hard', 'General')
ON CONFLICT (word) DO NOTHING;

-- 6. AJUSTAR SECUENCIAS
SELECT setval(pg_get_serial_sequence('django_content_type', 'id'), COALESCE((SELECT MAX(id) FROM django_content_type), 1));
SELECT setval(pg_get_serial_sequence('auth_permission', 'id'), COALESCE((SELECT MAX(id) FROM auth_permission), 1));
SELECT setval(pg_get_serial_sequence('words', 'id'), COALESCE((SELECT MAX(id) FROM words), 1));

COMMIT;
