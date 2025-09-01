import { query } from '../db.js';
import dotenv from 'dotenv';

dotenv.config();

const createTables = async () => {
	try {
		// Enable extensions
		await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
		await query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

		// Users table 
		await query(`
			CREATE TABLE IF NOT EXISTS users (
				id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				email VARCHAR(255) UNIQUE NOT NULL,
				name VARCHAR(255) NOT NULL,
				password_hash VARCHAR(255) NOT NULL,
				email_verified BOOLEAN DEFAULT false,
				reset_token VARCHAR(255),
				reset_token_expires TIMESTAMP WITH TIME ZONE,
				created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Ensure columns exist on existing installations
		await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255)`);
		await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE`);
		await query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'USER' CHECK (role IN ('USER','ORGANIZER','SPONSOR','ADMIN'))`);

		// Create indexes
		await query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`);
		await query(`CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token)`);

		// Events table
		await query(`
			CREATE TABLE IF NOT EXISTS events (
				id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				title VARCHAR(255) NOT NULL,
				description TEXT,
				category VARCHAR(100),
				starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
				ends_at TIMESTAMP WITH TIME ZONE,
				location_name VARCHAR(255),
				location_address TEXT,
				location_lat DECIMAL(10, 8),
				location_lng DECIMAL(11, 8),
				price_cents INTEGER DEFAULT 0,
				capacity INTEGER,
				image_url TEXT,
				status VARCHAR(50) DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'CANCELLED', 'COMPLETED')),
				
				-- Crowdfunding fields
				funding_goal_cents INTEGER DEFAULT 0,
				funding_deadline TIMESTAMP WITH TIME ZONE,
				min_funding_cents INTEGER DEFAULT 0,
				allow_donations BOOLEAN DEFAULT true,
				allow_sponsorships BOOLEAN DEFAULT true,
				
				created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Ensure crowdfunding columns exist on existing events table
		await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS funding_goal_cents INTEGER DEFAULT 0`);
		await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS funding_deadline TIMESTAMP WITH TIME ZONE`);
		await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS min_funding_cents INTEGER DEFAULT 0`);
		await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_donations BOOLEAN DEFAULT true`);
		await query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS allow_sponsorships BOOLEAN DEFAULT true`);

		// Event roles 
		await query(`
			CREATE TABLE IF NOT EXISTS event_roles (
				id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				event_id UUID REFERENCES events(id) ON DELETE CASCADE,
				user_id UUID REFERENCES users(id) ON DELETE CASCADE,
				role VARCHAR(50) NOT NULL CHECK (role IN ('ORGANIZER', 'CO_ORGANIZER', 'SPONSOR', 'ATTENDEE', 'VOLUNTEER')),
				permissions JSONB DEFAULT '{}',
				joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(event_id, user_id, role)
			)
		`);

		// Create indexes for event roles
		await query(`CREATE INDEX IF NOT EXISTS idx_event_roles_event ON event_roles(event_id)`);
		await query(`CREATE INDEX IF NOT EXISTS idx_event_roles_user ON event_roles(user_id)`);
		await query(`CREATE INDEX IF NOT EXISTS idx_event_roles_role ON event_roles(role)`);

		// Tickets table
		await query(`
			CREATE TABLE IF NOT EXISTS tickets (
				id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				quantity INTEGER DEFAULT 1,
				price_cents INTEGER NOT NULL,
				status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'REFUNDED')),
				payment_intent_id VARCHAR(255),
				purchased_at TIMESTAMP WITH TIME ZONE,
				created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
				updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
				UNIQUE(event_id, user_id)
			)
		`);

		// Sponsorship tiers
		await query(`
			CREATE TABLE IF NOT EXISTS sponsorship_tiers (
				id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				event_id UUID REFERENCES events(id) ON DELETE CASCADE,
				name VARCHAR(100) NOT NULL,
				description TEXT,
				amount_cents INTEGER NOT NULL,
				perks JSONB DEFAULT '[]',
				max_sponsors INTEGER,
				current_sponsors INTEGER DEFAULT 0,
				display_order INTEGER DEFAULT 0,
				created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Sponsorships/Donations
		await query(`
			CREATE TABLE IF NOT EXISTS sponsorships (
				id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				tier_id UUID REFERENCES sponsorship_tiers(id) ON DELETE SET NULL,
				amount_cents INTEGER NOT NULL,
				type VARCHAR(50) CHECK (type IN ('DONATION', 'SPONSORSHIP')) DEFAULT 'DONATION',
				message TEXT,
				company_name VARCHAR(255),
				company_logo TEXT,
				is_anonymous BOOLEAN DEFAULT false,
				status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'REFUNDED')),
				payment_intent_id VARCHAR(255),
				created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Crowdfunding contributions
		await query(`
			CREATE TABLE IF NOT EXISTS crowdfunding_contributions (
				id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
				user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
				amount_cents INTEGER NOT NULL,
				message TEXT,
				is_anonymous BOOLEAN DEFAULT false,
				status VARCHAR(50) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'CONFIRMED', 'REFUNDED')),
				payment_intent_id VARCHAR(255),
				created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Interactions for analytics
		await query(`
			CREATE TABLE IF NOT EXISTS interactions (
				id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
				user_id UUID REFERENCES users(id) ON DELETE CASCADE,
				event_id UUID REFERENCES events(id) ON DELETE CASCADE,
				action VARCHAR(50) NOT NULL CHECK (action IN ('view', 'click', 'save', 'share', 'purchase', 'donate')),
				metadata JSONB,
				created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
			)
		`);

		// Create update trigger
		await query(`
			CREATE OR REPLACE FUNCTION update_updated_at_column()
			RETURNS TRIGGER AS $$
			BEGIN
				NEW.updated_at = CURRENT_TIMESTAMP;
				RETURN NEW;
			END;
			$$ language 'plpgsql';
		`);

    // Messages table for chat functionality
    await query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      content TEXT NOT NULL,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_name VARCHAR(255) NOT NULL,
      type VARCHAR(20) NOT NULL CHECK (type IN ('event', 'private')),
      event_id UUID REFERENCES events(id) ON DELETE CASCADE,
      receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
      is_read BOOLEAN DEFAULT false,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure either event_id or receiver_id is set based on type
      CONSTRAINT check_message_target CHECK (
        (type = 'event' AND event_id IS NOT NULL AND receiver_id IS NULL) OR
        (type = 'private' AND receiver_id IS NOT NULL AND event_id IS NULL)
    )
  )
    `);

    // Create indexes for better performance
    await query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_event ON chat_messages(event_id, created_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_private ON chat_messages(sender_id, receiver_id, created_at)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_chat_messages_receiver ON chat_messages(receiver_id, is_read)`);

    // Chat participants table to track who's in which chats
    await query(`
      CREATE TABLE IF NOT EXISTS chat_participants (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_id UUID REFERENCES events(id) ON DELETE CASCADE,
      other_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      last_read_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure either event_id or other_user_id is set
      CONSTRAINT check_chat_type CHECK (
        (event_id IS NOT NULL AND other_user_id IS NULL) OR
        (other_user_id IS NOT NULL AND event_id IS NULL)
      ),
    
    -- Unique constraint to prevent duplicates
      UNIQUE(user_id, event_id, other_user_id)
  )
`);

    await query(`CREATE INDEX IF NOT EXISTS idx_chat_participants_user ON chat_participants(user_id)`);
    await query(`CREATE INDEX IF NOT EXISTS idx_chat_participants_event ON chat_participants(event_id)`);

		// Apply trigger to tables
		const tables = ['users', 'events', 'tickets'];
		for (const table of tables) {
			await query(`
				DROP TRIGGER IF EXISTS update_${table}_updated_at ON ${table};
				CREATE TRIGGER update_${table}_updated_at 
				BEFORE UPDATE ON ${table} 
				FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
			`);
		}

		console.log('Database tables created successfully');
		process.exit(0);
	} catch (error) {
		console.error('Error creating tables:', error);
		process.exit(1);
	}
};

createTables();