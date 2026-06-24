-- ============================================================================
-- PDF Assets Registry Seed
-- 
-- Ready-to-run seed file for all 29 premium PDFs
-- Run this after uploading PDFs to the 'premium-pdfs' storage bucket
-- ============================================================================

-- Clear existing data (optional - remove if you want to keep existing records)
-- DELETE FROM pdf_assets WHERE is_premium = true;

-- Insert all 29 premium PDFs
INSERT INTO pdf_assets (
  file_key,
  title,
  topic_id,
  category_id,
  is_premium,
  is_public_sample,
  storage_path,
  content_type
) VALUES
  -- ==================== HOME & LIVING SPACE ====================
  (
    'Kitchen_Household_Interview_Practice_Questions.pdf',
    'Kitchen & Household: The #1 Topic Officers ALWAYS Ask',
    'kitchen-household',
    'home-living',
    true,
    false,
    'premium-pdfs/Kitchen_Household_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Living_Room_Interview_Practice_Questions.pdf',
    'Living Room Secrets: What Your Couch Says About Your Marriage',
    'living-room',
    'home-living',
    true,
    false,
    'premium-pdfs/Living_Room_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Bedroom_Interview_Practice_Questions.pdf',
    'Bedroom Questions That Make Couples PANIC (Be Ready!)',
    'bedroom',
    'home-living',
    true,
    false,
    'premium-pdfs/Bedroom_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Bathroom_Interview_Practice_Questions.pdf',
    'Bathroom Trivia: The Sneakiest Questions Officers Ask',
    'bathroom',
    'home-living',
    true,
    false,
    'premium-pdfs/Bathroom_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Dining_Area_Interview_Practice_Questions.pdf',
    'Dining Area: What You Eat Reveals EVERYTHING',
    'dining-area',
    'home-living',
    true,
    false,
    'premium-pdfs/Dining_Area_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Entryway_Front_Door_Keys_Mail_Interview_Practice_Questions.pdf',
    'Entryway & Front Door: Keys, Mail, and Daily Routines',
    'entryway-keys-mail',
    'home-living',
    true,
    false,
    'premium-pdfs/Entryway_Front_Door_Keys_Mail_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Basement_Storage_Utility_Area_Interview_Practice_Questions.pdf',
    'Basement, Storage & Utility Areas',
    'basement-storage',
    'home-living',
    true,
    false,
    'premium-pdfs/Basement_Storage_Utility_Area_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Outdoor_Balcony_Backyard_Interview_Practice_Questions.pdf',
    'Outdoor Spaces: Balcony, Backyard & Parking',
    'outdoor-spaces',
    'home-living',
    true,
    false,
    'premium-pdfs/Outdoor_Balcony_Backyard_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),

  -- ==================== DAILY LIFE & ROUTINE ====================
  (
    'Daily_Routine_Real_Life_Interview_Practice_Questions.pdf',
    'Daily Routine & Real Life: Prove You Live Together',
    'daily-routine',
    'daily-routine',
    true,
    false,
    'premium-pdfs/Daily_Routine_Real_Life_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Closet_Clothing_Laundry_Interview_Practice_Questions.pdf',
    'Closet, Clothing & Laundry: Whose Clothes Are Where?',
    'closet-clothing',
    'daily-routine',
    true,
    false,
    'premium-pdfs/Closet_Clothing_Laundry_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Car_Driving_Routine_Parking_Interview_Practice_Questions.pdf',
    'Car, Driving & Parking: Vehicle Questions That Trip People Up',
    'car-driving',
    'daily-routine',
    true,
    false,
    'premium-pdfs/Car_Driving_Routine_Parking_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Home_Office_Desk_Area_Interview_Practice_Questions.pdf',
    'Home Office & Desk Area: Remote Work Questions',
    'home-office',
    'daily-routine',
    true,
    false,
    'premium-pdfs/Home_Office_Desk_Area_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),

  -- ==================== RELATIONSHIP & HISTORY ====================
  (
    'Relationship_Timeline_How_It_Started_Interview_Practice_Questions.pdf',
    'Relationship Timeline: How It Started, How It''s Going',
    'relationship-timeline',
    'relationship',
    true,
    false,
    'premium-pdfs/Relationship_Timeline_How_It_Started_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Wedding_and_Celebrations_Interview_Practice_Questions.pdf',
    'Wedding & Celebrations: Your Big Day Under Scrutiny',
    'wedding-celebrations',
    'relationship',
    true,
    false,
    'premium-pdfs/Wedding_and_Celebrations_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Anniversaries_Birthdays_Holidays_Traditions_Interview_Practice_Questions.pdf',
    'Anniversaries, Birthdays, Holidays & Traditions',
    'anniversaries-traditions',
    'relationship',
    true,
    false,
    'premium-pdfs/Anniversaries_Birthdays_Holidays_Traditions_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Travel_and_Vacations_Interview_Practice_Questions.pdf',
    'Travel & Vacations: Trips You''ve Taken Together',
    'travel-vacations',
    'relationship',
    true,
    false,
    'premium-pdfs/Travel_and_Vacations_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),

  -- ==================== FINANCIAL & LEGAL ====================
  (
    'Money_Bills_Shared_Responsibilities_Interview_Practice_Questions.pdf',
    'Money, Bills & Shared Responsibilities',
    'money-bills',
    'financial',
    true,
    false,
    'premium-pdfs/Money_Bills_Shared_Responsibilities_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Insurance_and_Healthcare_Interview_Practice_Questions.pdf',
    'Insurance & Healthcare: Coverage Questions',
    'insurance-healthcare',
    'financial',
    true,
    false,
    'premium-pdfs/Insurance_and_Healthcare_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Work_and_Income_Basics_Interview_Practice_Questions.pdf',
    'Work & Income Basics: Employment Questions',
    'work-income',
    'financial',
    true,
    false,
    'premium-pdfs/Work_and_Income_Basics_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Address_History_and_Moves_Interview_Practice_Questions.pdf',
    'Address History & Moves: Where You''ve Lived',
    'address-history',
    'financial',
    true,
    false,
    'premium-pdfs/Address_History_and_Moves_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),

  -- ==================== FAMILY & SOCIAL ====================
  (
    'Family_InLaws_Social_Circle_Interview_Practice_Questions.pdf',
    'Family, In-Laws & Social Circle: People In Your Lives',
    'family-inlaws',
    'family-social',
    true,
    false,
    'premium-pdfs/Family_InLaws_Social_Circle_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Community_Ties_Interview_Practice_Questions.pdf',
    'Community Ties: Friends, Neighbors & Activities',
    'community-ties',
    'family-social',
    true,
    false,
    'premium-pdfs/Community_Ties_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Children_Custody_Parenting_Plans_Interview_Practice_Questions.pdf',
    'Children, Custody & Parenting Plans: Family Questions',
    'children-custody',
    'family-social',
    true,
    false,
    'premium-pdfs/Children_Custody_Parenting_Plans_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Conflict_Resolution_Household_Decisions_Interview_Practice_Questions.pdf',
    'Conflict Resolution & Household Decisions',
    'conflict-resolution',
    'family-social',
    true,
    false,
    'premium-pdfs/Conflict_Resolution_Household_Decisions_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),

  -- ==================== TECHNOLOGY & COMMUNICATION ====================
  (
    'Phones_and_Digital_Life_Interview_Practice_Questions.pdf',
    'Phones & Digital Life: Tech Questions',
    'phones-digital',
    'tech-communication',
    true,
    false,
    'premium-pdfs/Phones_and_Digital_Life_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),
  (
    'Evidence_of_Shared_Life_Interview_Practice_Questions.pdf',
    'Evidence of Shared Life: Photos, Messages & Documents',
    'evidence-shared-life',
    'tech-communication',
    true,
    false,
    'premium-pdfs/Evidence_of_Shared_Life_Interview_Practice_Questions.pdf',
    'application/pdf'
  ),

  -- ==================== SPECIAL PRACTICE ====================
  (
    'Rapid_Fire_Memory_Test_Drill_50_Questions.pdf',
    'Rapid-Fire Memory Test Drill: 50 Quick Questions',
    'rapid-fire-drill',
    'special-practice',
    true,
    false,
    'premium-pdfs/Rapid_Fire_Memory_Test_Drill_50_Questions.pdf',
    'application/pdf'
  ),
  (
    'Red_Flag_Consistency_Topics_Interview_Practice_Questions.pdf',
    'Red Flag & Consistency Topics: Trick Questions to Watch For',
    'red-flag-topics',
    'special-practice',
    true,
    false,
    'premium-pdfs/Red_Flag_Consistency_Topics_Interview_Practice_Questions.pdf',
    'application/pdf'
  );

-- ============================================================================
-- Verification Query (run this to confirm all PDFs were inserted)
-- ============================================================================
-- SELECT category_id, COUNT(*) as pdf_count 
-- FROM pdf_assets 
-- WHERE is_premium = true 
-- GROUP BY category_id 
-- ORDER BY category_id;

-- Expected result: 29 rows total across 7 categories
-- home-living: 8
-- daily-routine: 4
-- relationship: 4
-- financial: 4
-- family-social: 4
-- tech-communication: 2
-- special-practice: 2
