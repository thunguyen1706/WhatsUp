import { query } from '../db.js';
import argon2 from 'argon2';
import { faker } from '@faker-js/faker';
import dotenv from 'dotenv';

dotenv.config();

// Set seed for consistent data
faker.seed(123);

const seedDatabase = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data in correct order (respecting foreign keys)
    await query('TRUNCATE TABLE interactions, crowdfunding_contributions, sponsorships, tickets, event_roles, events, users CASCADE');

    // Create password hash (same for all seeded users)
    const passwordHash = await argon2.hash('password123');
    
    // Create admin user 
    console.log('👑 Creating admin user...');
    const adminResult = await query(`
      INSERT INTO users (email, name, password_hash, role, email_verified)
      VALUES ($1, $2, $3, 'ADMIN', true)
      RETURNING id, email, name, role
    `, ['admin@example.com', 'Admin User', passwordHash]);
    
    const adminId = adminResult.rows[0].id;
    console.log('✅ Admin created:', adminResult.rows[0].email);

    // Create organizers with faker
    console.log('👥 Creating organizers...');
    const organizers = [];
    for (let i = 0; i < 10; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const result = await query(`
        INSERT INTO users (email, name, password_hash, role, email_verified, created_at)
        VALUES ($1, $2, $3, 'ORGANIZER', $4, $5)
        RETURNING id, email, name, role
      `, [
        `organizer${i + 1}@example.com`,
        `${firstName} ${lastName}`,
        passwordHash,
        faker.datatype.boolean({ probability: 0.8 }), 
        faker.date.past({ years: 2 })
      ]);
      organizers.push(result.rows[0]);
    }
    console.log(`✅ Created ${organizers.length} organizers`);

    // Create sponsors with faker
    console.log('🏢 Creating sponsors...');
    const sponsors = [];
    for (let i = 0; i < 10; i++) {
      const companyName = faker.company.name();
      const result = await query(`
        INSERT INTO users (email, name, password_hash, role, email_verified, created_at)
        VALUES ($1, $2, $3, 'SPONSOR', true, $4)
        RETURNING id, email, name, role
      `, [
        `sponsor${i + 1}@example.com`,
        companyName,
        passwordHash,
        faker.date.past({ years: 1 })
      ]);
      sponsors.push(result.rows[0]);
    }
    console.log(`✅ Created ${sponsors.length} sponsors`);

    // Create regular users with faker
    console.log('👤 Creating regular users...');
    const users = [];
    for (let i = 0; i < 50; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const result = await query(`
        INSERT INTO users (email, name, password_hash, role, email_verified, created_at)
        VALUES ($1, $2, $3, 'USER', $4, $5)
        RETURNING id, email, name, role
      `, [
        `user${i + 1}@example.com`,
        `${firstName} ${lastName}`,
        passwordHash,
        faker.datatype.boolean({ probability: 0.7 }), 
        faker.date.past({ years: 3 })
      ]);
      users.push(result.rows[0]);
    }
    console.log(`✅ Created ${users.length} regular users`);

    // Event categories that match your frontend
    const eventCategories = [
      'music', 'sports', 'food-drink', 'arts-culture', 
      'business', 'technology', 'health-wellness', 'education', 
      'community', 'entertainment', 'outdoor', 'family'
    ];

    // Sample locations with realistic coordinates
    const sampleLocations = [
      { name: 'Downtown Convention Center', address: '123 Main St, Downtown', lat: 40.7128, lng: -74.0060 },
      { name: 'Central Park Pavilion', address: '456 Park Ave, Central District', lat: 40.7589, lng: -73.9851 },
      { name: 'Riverside Community Center', address: '789 River Rd, Riverside', lat: 40.7505, lng: -73.9934 },
      { name: 'Tech Hub Auditorium', address: '321 Innovation Blvd, Tech District', lat: 40.7282, lng: -74.0776 },
      { name: 'Art Gallery District', address: '654 Culture St, Arts Quarter', lat: 40.7614, lng: -73.9776 },
      { name: 'Sports Complex Arena', address: '987 Stadium Way, Sports District', lat: 40.7831, lng: -73.9712 },
      { name: 'Beachside Event Space', address: '147 Ocean View Dr, Beachfront', lat: 40.7589, lng: -73.9851 },
      { name: 'Mountain View Lodge', address: '258 Highland Ave, Mountain District', lat: 40.7899, lng: -73.9441 }
    ];

    // Create events with faker
    console.log('🎉 Creating events...');
    const events = [];
    for (let i = 0; i < 50; i++) {
      const organizer = faker.helpers.arrayElement(organizers);
      if (!organizer || !organizer.id) {
        console.error(`Skipping event ${i + 1}: missing organizer`);
        continue;
      }
      const category = faker.helpers.arrayElement(eventCategories);
      const location = faker.helpers.arrayElement(sampleLocations);
      
      // Generate future dates
      const startsAt = faker.date.future({ years: 1 });
      const endsAt = new Date(startsAt.getTime() + faker.number.int({ min: 2, max: 8 }) * 60 * 60 * 1000); 
      
      // Generate event title based on category
      let title = '';
      switch(category) {
        case 'technology':
          title = `${faker.company.buzzAdjective()} Tech Summit ${startsAt.getFullYear()}`;
          break;
        case 'music':
          title = `${faker.music.genre()} ${faker.helpers.arrayElement(['Festival', 'Concert', 'Night', 'Experience'])}`;
          break;
        case 'food-drink':
          title = `${faker.location.city()} ${faker.helpers.arrayElement(['Food Festival', 'Wine Tasting', 'Culinary Experience'])}`;
          break;
        case 'sports':
          title = `${faker.helpers.arrayElement(['Annual', 'Summer', 'Winter'])} ${faker.helpers.arrayElement(['Marathon', 'Tournament', 'Championship'])}`;
          break;
        case 'business':
          title = `${faker.company.buzzPhrase()} Conference`;
          break;
        case 'arts-culture':
          title = `${faker.helpers.arrayElement(['Modern', 'Classical', 'Contemporary'])} ${faker.helpers.arrayElement(['Art Exhibition', 'Cultural Festival', 'Gallery Opening'])}`;
          break;
        default:
          title = `${faker.company.catchPhrase()} ${category.replace('-', ' ')} Event`;
      }
      
      // Pricing - mix of free and paid events
      const isFree = faker.datatype.boolean(0.3); // 30% free events
      const priceCents = isFree ? 0 : faker.number.int({ min: 1000, max: 15000 }); // $10-$150
      
      // Crowdfunding settings
      const hasCrowdfunding = faker.datatype.boolean(0.4); // 40% have crowdfunding
      const fundingGoalCents = hasCrowdfunding ? faker.number.int({ min: 100000, max: 1000000 }) : 0; // $1k-$10k
      const fundingDeadline = hasCrowdfunding ? faker.date.future({ years: 1 }) : null;
      
      try {
        const description = [
          `${title} — ${faker.company.catchPhrase()}.`,
          `Join us at ${location.name} in ${faker.location.city()} for an engaging ${category.replace('-', ' ')} experience.`,
          `Highlights include ${faker.commerce.productAdjective()} sessions, networking, and more.`
        ].join('\n\n');

        const result = await query(`
          INSERT INTO events (
            title, description, category, starts_at, ends_at,
            location_name, location_address, location_lat, location_lng,
            price_cents, capacity, organizer_id, status, image_url, created_at,
            funding_goal_cents, funding_deadline, min_funding_cents,
            allow_donations, allow_sponsorships
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          RETURNING id, title, category, starts_at, price_cents
        `, [
          title,
          faker.lorem.paragraphs({ min: 2, max: 3 }),
          category,
          startsAt,
          endsAt,
          location.name,
          location.address,
          location.lat,
          location.lng,
          priceCents,
          faker.number.int({ min: 50, max: 500 }), // capacity
          organizer.id,
          'PUBLISHED', // Make sure all events are published
          `https://picsum.photos/400/300?random=${i + 1}`,
          faker.date.past({ years: 1 }),
          fundingGoalCents,
          fundingDeadline,
          hasCrowdfunding ? Math.floor(fundingGoalCents * 0.1) : 0, // min 10% of goal
          true, // allow_donations
          true  // allow_sponsorships
        ]);
        
        const event = result.rows[0];
        events.push(event);

        // Create event role for organizer
        await query(`
          INSERT INTO event_roles (event_id, user_id, role)
          VALUES ($1, $2, 'ORGANIZER')
        `, [event.id, organizer.id]);

      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`Error creating event ${i + 1}:`, message);
      }
    }
    console.log(`✅ Created ${events.length} events`);

    // Create tickets for events
    console.log('🎫 Creating tickets...');
    let ticketCount = 0;
    for (const event of events) {
      // Skip free events for ticket creation complexity
      if (event.price_cents === 0) continue;
      
      const numTickets = faker.number.int({ min: 5, max: 25 });
      
      for (let i = 0; i < numTickets; i++) {
        const user = faker.helpers.arrayElement(users);
        
        try {
          // Check if user already has ticket for this event
          const existing = await query(
            'SELECT id FROM tickets WHERE user_id = $1 AND event_id = $2',
            [user.id, event.id]
          );
          
          if (existing.rows.length === 0) {
            const quantity = faker.number.int({ min: 1, max: 3 });
            const status = faker.helpers.weightedArrayElement([
              { weight: 80, value: 'CONFIRMED' },
              { weight: 15, value: 'PENDING' },
              { weight: 5, value: 'CANCELLED' }
            ]);
            
            await query(`
              INSERT INTO tickets (event_id, user_id, quantity, price_cents, status, purchased_at, created_at)
              VALUES ($1, $2, $3, $4, $5, $6, $7)
            `, [
              event.id,
              user.id,
              quantity,
              event.price_cents * quantity,
              status,
              status === 'CONFIRMED' ? faker.date.recent({ days: 60 }) : null,
              faker.date.recent({ days: 60 })
            ]);
            
            if (status === 'CONFIRMED') ticketCount++;
          }
        } catch (error) {
          // Skip if duplicate or other error
        }
      }
    }
    console.log(`✅ Created ${ticketCount} confirmed tickets`);

    // Create sponsorships (using the correct table name)
    console.log('🤝 Creating sponsorships...');
    let sponsorshipCount = 0;
    for (let i = 0; i < 30; i++) {
      const sponsor = faker.helpers.arrayElement(sponsors);
      const event = faker.helpers.arrayElement(events);
      
      try {
        await query(`
          INSERT INTO sponsorships (event_id, user_id, amount_cents, type, message, is_anonymous, status, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          event.id,
          sponsor.id,
          faker.helpers.arrayElement([5000, 10000, 25000, 50000, 100000]), 
          faker.helpers.arrayElement(['DONATION', 'SPONSORSHIP']),
          faker.helpers.maybe(() => faker.company.catchPhrase(), { probability: 0.7 }),
          faker.datatype.boolean({ probability: 0.2 }), 
          faker.helpers.weightedArrayElement([
            { weight: 90, value: 'CONFIRMED' },
            { weight: 10, value: 'PENDING' }
          ]),
          faker.date.recent({ days: 30 })
        ]);
        sponsorshipCount++;
      } catch (error) {
        // Skip duplicates
      }
    }
    console.log(`✅ Created ${sponsorshipCount} sponsorships`);

    // Create crowdfunding contributions
    console.log('💰 Creating crowdfunding contributions...');
    let contributionCount = 0;
    
    for (const event of events.slice(0, 20)) { // First 20 events
      const numContributions = faker.number.int({ min: 3, max: 15 });
      
      for (let i = 0; i < numContributions; i++) {
        const user = faker.helpers.arrayElement([...users, ...sponsors]);
        
        try {
          await query(`
            INSERT INTO crowdfunding_contributions (event_id, user_id, amount_cents, message, is_anonymous, status, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            event.id,
            user.id,
            faker.number.int({ min: 1000, max: 10000 }), // $10-$100
            faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.5 }),
            faker.datatype.boolean({ probability: 0.3 }), 
            'CONFIRMED',
            faker.date.recent({ days: 45 })
          ]);
          contributionCount++;
        } catch (error) {
          // Skip duplicates
        }
      }
    }
    console.log(`✅ Created ${contributionCount} crowdfunding contributions`);

    // Create interactions for analytics
    console.log('📊 Creating interactions...');
    let interactionCount = 0;
    
    for (let i = 0; i < 200; i++) {
      const user = faker.helpers.arrayElement([...users, ...organizers, ...sponsors]);
      const event = faker.helpers.arrayElement(events);
      const action = faker.helpers.weightedArrayElement([
        { weight: 40, value: 'view' },
        { weight: 30, value: 'click' },
        { weight: 15, value: 'save' },
        { weight: 10, value: 'share' },
        { weight: 5, value: 'purchase' }
      ]);
      
      try {
        await query(`
          INSERT INTO interactions (user_id, event_id, action, created_at)
          VALUES ($1, $2, $3, $4)
        `, [
          user.id,
          event.id,
          action,
          faker.date.recent({ days: 30 })
        ]);
        interactionCount++;
      } catch (error) {
        // Skip errors
      }
    }
    console.log(`✅ Created ${interactionCount} interactions`);

    // Show final summary
    const finalStats = await query(`
      SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM users WHERE role = 'ORGANIZER') as organizers,
        (SELECT COUNT(*) FROM events WHERE status = 'PUBLISHED') as published_events,
        (SELECT COUNT(*) FROM tickets WHERE status = 'CONFIRMED') as confirmed_tickets,
        (SELECT COUNT(*) FROM sponsorships WHERE status = 'CONFIRMED') as sponsorships,
        (SELECT COUNT(*) FROM crowdfunding_contributions WHERE status = 'CONFIRMED') as contributions
    `);

    const stats = finalStats.rows[0];
    
    console.log('\n📊 Seeding Summary:');
    console.log(`👥 Total Users: ${stats.total_users}`);
    console.log(`👨‍💼 Organizers: ${stats.organizers}`);
    console.log(`🎉 Published Events: ${stats.published_events}`);
    console.log(`🎫 Confirmed Tickets: ${stats.confirmed_tickets}`);
    console.log(`🤝 Sponsorships: ${stats.sponsorships}`);
    console.log(`💰 Crowdfunding Contributions: ${stats.contributions}`);
    
    console.log('\n🔑 Test Credentials (password: "password123"):');
    console.log('🔸 Admin: admin@example.com');
    console.log('🔸 Organizer: organizer1@example.com');
    console.log('🔸 Sponsor: sponsor1@example.com');
    console.log('🔸 User: user1@example.com');
    
    console.log('\n🎉 Database seeded successfully with realistic data!');
    
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error details:', message);
    throw error;
  }
};

// Run the seeding
seedDatabase()
  .then(() => {
    console.log('\n✨ Seeding completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seeding failed:', error);
    process.exit(1);
  });