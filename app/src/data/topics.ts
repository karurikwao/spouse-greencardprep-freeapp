export interface SampleQA {
  question: string;
  sampleAnswer: string;
  tip?: string;
}

export interface Topic {
  id: string;
  title: string;
  description: string;
  category: string;
  pdfFileName: string;
  questionCount: string;
  icon: string;
  sampleQA: SampleQA[];
  checklist: string[];
}

export interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

export const categories: Category[] = [
  {
    id: "home-living",
    name: "Home & Living Space",
    description: "Questions about your physical living environment and household details",
    icon: "Home",
    color: "bg-blue-500"
  },
  {
    id: "daily-routine",
    name: "Daily Life & Routine",
    description: "Questions about your everyday habits and schedules",
    icon: "Calendar",
    color: "bg-green-500"
  },
  {
    id: "relationship",
    name: "Relationship & History",
    description: "Questions about how you met, your journey, and celebrations",
    icon: "Heart",
    color: "bg-rose-500"
  },
  {
    id: "financial",
    name: "Financial & Legal",
    description: "Questions about money, bills, work, and address history",
    icon: "Wallet",
    color: "bg-amber-500"
  },
  {
    id: "family-social",
    name: "Family & Social",
    description: "Questions about family, friends, and community connections",
    icon: "Users",
    color: "bg-purple-500"
  },
  {
    id: "tech-communication",
    name: "Technology & Communication",
    description: "Questions about digital life and shared evidence",
    icon: "Smartphone",
    color: "bg-cyan-500"
  },
  {
    id: "special-practice",
    name: "Special Practice",
    description: "Intensive drills and sensitive topic preparation",
    icon: "Target",
    color: "bg-red-600"
  }
];

export const topics: Topic[] = [
  // ==================== HOME & LIVING SPACE ====================
  {
    id: "kitchen-household",
    title: "Kitchen & Household: The #1 Topic Officers ALWAYS Ask",
    description: "Don't get caught off guard! Master trash routines, grocery habits, and fridge organization - these 'boring' details can make or break your case",
    category: "home-living",
    pdfFileName: "Kitchen_Household_Interview_Practice_Questions.pdf",
    questionCount: "50+",
    icon: "UtensilsCrossed",
    sampleQA: [
      {
        question: "Where is the kitchen trash can located?",
        sampleAnswer: "Our trash can is under the sink on the left side. It's a white step-pedal bin with a lid that we got from Target.",
        tip: "Be specific about location and appearance."
      },
      {
        question: "Who usually takes out the trash?",
        sampleAnswer: "I usually take it out on Tuesday and Friday evenings because I get home earlier, around 5:30 PM. My spouse takes it out on Sunday nights."
      },
      {
        question: "What did you eat for dinner last night?",
        sampleAnswer: "We had chicken stir-fry with vegetables and rice. I cooked it around 7 PM and we ate together at the dining table. My spouse helped chop the vegetables."
      },
      {
        question: "Where do you keep your spices?",
        sampleAnswer: "We keep our spices in the cabinet above the stove, organized in a rack. The most used ones like salt, pepper, and garlic powder are in the front."
      },
      {
        question: "What brand of dish soap do you use?",
        sampleAnswer: "We use Dawn dish soap, the blue one. It's kept in a dispenser next to the sink."
      },
      {
        question: "Who does the grocery shopping?",
        sampleAnswer: "We usually go together on Saturday mornings to Trader Joe's. Sometimes my spouse picks up items during the week if we run out of something."
      }
    ],
    checklist: [
      "Know trash/recycling locations and pickup days",
      "Remember your last few meals",
      "Know where groceries and spices are stored",
      "Be clear on who cooks and when",
      "Remember dish soap and cleaning supplies brands",
      "Know your typical grocery shopping routine"
    ]
  },
  {
    id: "living-room",
    title: "Living Room Secrets: What Your Couch Says About Your Marriage",
    description: "Officers use these 'innocent' questions to catch inconsistencies. Know your TV size, furniture colors, and who controls the remote - or risk denial",
    category: "home-living",
    pdfFileName: "Living_Room_Interview_Practice_Questions.pdf",
    questionCount: "40+",
    icon: "Sofa",
    sampleQA: [
      {
        question: "What size is your main TV?",
        sampleAnswer: "We have a 55-inch Samsung smart TV. It's mounted on the wall opposite the gray sectional couch."
      },
      {
        question: "What do you use for streaming?",
        sampleAnswer: "We use Netflix, Hulu, and Amazon Prime. We mostly watch Netflix on my spouse's account. We also have Disney+ for movies."
      },
      {
        question: "What color is your couch?",
        sampleAnswer: "Our couch is charcoal gray. It's a three-seater sectional that we bought from IKEA about two years ago."
      },
      {
        question: "Where do you keep the TV remote?",
        sampleAnswer: "We keep the remote on the coffee table, usually on a coaster. We also have the Roku remote there."
      },
      {
        question: "What do you usually do in the living room?",
        sampleAnswer: "We watch TV in the evenings, usually from 8 to 10 PM. Sometimes I read on the couch while my spouse watches sports."
      },
      {
        question: "Do you have curtains or blinds?",
        sampleAnswer: "We have white curtains from Target on the large window, and wooden blinds on the smaller window facing the street."
      }
    ],
    checklist: [
      "Know your TV size and brand",
      "Remember streaming services you use",
      "Know furniture colors and arrangements",
      "Be clear on who controls the remote",
      "Remember curtain/blind types and colors",
      "Know your evening routines in the living room"
    ]
  },
  {
    id: "bedroom",
    title: "Bedroom Questions That Make Couples PANIC (Be Ready!)",
    description: "Which side of the bed? What color sheets? These intimate details prove you live together. Get them wrong and raise instant red flags",
    category: "home-living",
    pdfFileName: "Bedroom_Interview_Practice_Questions.pdf",
    questionCount: "45+",
    icon: "Bed",
    sampleQA: [
      {
        question: "What size is your bed?",
        sampleAnswer: "We have a queen-size bed with a gray upholstered headboard. We bought it from Wayfair last year."
      },
      {
        question: "Which side of the bed does each person sleep on?",
        sampleAnswer: "I sleep on the left side near the window, and my spouse sleeps on the right side near the door. We've slept this way since we moved in together."
      },
      {
        question: "What time do you usually go to bed?",
        sampleAnswer: "On weekdays, we usually go to bed around 10:30 PM. On weekends, it might be closer to midnight if we're watching a movie."
      },
      {
        question: "What color are your bedsheets?",
        sampleAnswer: "Right now we have white sheets with a light blue duvet cover. We change them every Sunday."
      },
      {
        question: "Do you use an alarm clock or phone?",
        sampleAnswer: "We both use our phones. My alarm goes off at 6:45 AM, and my spouse's goes off at 7 AM."
      },
      {
        question: "Where do you keep your clothes?",
        sampleAnswer: "I use the left side of the closet and the top two drawers of the dresser. My spouse uses the right side of the closet and the bottom drawers."
      }
    ],
    checklist: [
      "Know bed size and sheet colors",
      "Remember which side each person sleeps on",
      "Know typical bedtime and wake time",
      "Be clear on alarm settings",
      "Remember closet and dresser organization",
      "Know how often you change sheets"
    ]
  },
  {
    id: "bathroom",
    title: "Bathroom Trivia: The Sneakiest Questions Officers Ask",
    description: "Toothpaste brands, shower schedules, towel colors - these tiny details expose fake marriages. Master them before you walk into that room",
    category: "home-living",
    pdfFileName: "Bathroom_Interview_Practice_Questions.pdf",
    questionCount: "35+",
    icon: "Bath",
    sampleQA: [
      {
        question: "What brand of toothpaste do you use?",
        sampleAnswer: "We use Crest Pro-Health. It's the blue tube. I keep mine on the left side of the sink, and my spouse keeps theirs on the right."
      },
      {
        question: "Who showers first in the morning?",
        sampleAnswer: "My spouse showers first around 6:30 AM because they need to leave earlier for work. I shower after at about 7:15 AM."
      },
      {
        question: "What color are your towels?",
        sampleAnswer: "We have white towels for everyday use and navy blue towels for guests. They're hanging on the rack next to the shower."
      },
      {
        question: "Where do you keep your toothbrushes?",
        sampleAnswer: "We have a cup on the sink counter. Mine is the blue toothbrush, and my spouse's is the green one."
      },
      {
        question: "What shampoo do you use?",
        sampleAnswer: "I use Head & Shoulders, and my spouse uses Pantene. They're both in the shower caddy."
      },
      {
        question: "Who cleans the bathroom?",
        sampleAnswer: "I usually clean it on Saturdays. My spouse helps by wiping down the sink during the week."
      }
    ],
    checklist: [
      "Know toiletries brands you use",
      "Remember shower/bathroom routine",
      "Know where towels are stored",
      "Be clear on cleaning responsibilities",
      "Remember toothbrush and personal item locations",
      "Know shampoo and soap brands"
    ]
  },
  {
    id: "dining-area",
    title: "Dining Area: What You Eat Reveals EVERYTHING",
    description: "Last night's dinner, who sets the table, your placemat colors - officers use meals to verify your daily life together. Don't leave this to chance",
    category: "home-living",
    pdfFileName: "Dining_Area_Interview_Practice_Questions.pdf",
    questionCount: "30+",
    icon: "Utensils",
    sampleQA: [
      {
        question: "Where do you usually eat dinner?",
        sampleAnswer: "We usually eat at the dining table in the kitchen area. It's a wooden table that seats four. Sometimes we eat on the couch when watching a movie."
      },
      {
        question: "What time do you usually eat dinner?",
        sampleAnswer: "We typically eat dinner between 6:30 and 7:30 PM, depending on when we both get home from work."
      },
      {
        question: "What kind of dining table do you have?",
        sampleAnswer: "We have a light oak table with four matching chairs. We bought it from IKEA when we moved in."
      },
      {
        question: "Do you use placemats?",
        sampleAnswer: "Yes, we have gray fabric placemats that we use for dinner. We keep them in the drawer next to the napkins."
      },
      {
        question: "Who sets the table?",
        sampleAnswer: "Whoever is cooking usually sets the table while the food is finishing up. We take turns cooking."
      },
      {
        question: "Do you eat breakfast together?",
        sampleAnswer: "Not usually on weekdays because my spouse leaves earlier. On weekends, we have breakfast together around 9 AM."
      }
    ],
    checklist: [
      "Know typical meal times",
      "Remember where you usually eat",
      "Know your dining table details",
      "Be clear on who sets the table",
      "Remember placemats and table settings",
      "Know your breakfast routine"
    ]
  },
  {
    id: "entryway",
    title: "Entryway & Keys: The Questions That TRAP Unprepared Couples",
    description: "Where do you hang your keys? Who checked the mail yesterday? These routine details separate real couples from frauds. Know them cold",
    category: "home-living",
    pdfFileName: "Entryway_Front_Door_Keys_Mail_Interview_Practice_Questions.pdf",
    questionCount: "40+",
    icon: "Key",
    sampleQA: [
      {
        question: "Where do you keep your keys when you come home?",
        sampleAnswer: "We have a small hook rack by the door. I always hang my keys on the second hook. My spouse uses the first one. We've done this since we moved in."
      },
      {
        question: "Who checked the mail most recently?",
        sampleAnswer: "I checked it yesterday evening around 6 PM when I got home. There were some bills, a magazine, and a package notification."
      },
      {
        question: "Do you have a doormat?",
        sampleAnswer: "Yes, we have a brown coir doormat that says 'Welcome' on it. It's right outside the front door."
      },
      {
        question: "Where is your mailbox?",
        sampleAnswer: "Our mailbox is in the lobby of our building, near the elevator. We have box number 4B."
      },
      {
        question: "Do you have a spare key?",
        sampleAnswer: "Yes, we keep a spare key in a lockbox outside, and another one with our neighbor Mrs. Chen in apartment 4A."
      },
      {
        question: "What do you do with mail when it comes in?",
        sampleAnswer: "We put it on the kitchen counter. Bills go in the organizer on the fridge, and junk mail gets recycled immediately."
      }
    ],
    checklist: [
      "Know where keys are kept",
      "Remember mail checking routine",
      "Know which door you use most",
      "Be clear on spare key location",
      "Remember doormat details",
      "Know mailbox location"
    ]
  },
  {
    id: "basement-storage",
    title: "Storage & Utilities: The 'Hidden' Questions They ALWAYS Ask",
    description: "Circuit breaker location, seasonal storage spots, document hiding places - these prove you actually SHARE a home. Master them now",
    category: "home-living",
    pdfFileName: "Basement_Storage_Utility_Area_Interview_Practice_Questions.pdf",
    questionCount: "25+",
    icon: "Archive",
    sampleQA: [
      {
        question: "Where do you store seasonal items?",
        sampleAnswer: "We keep winter clothes and holiday decorations in plastic bins in the closet under the stairs."
      },
      {
        question: "Where is your circuit breaker?",
        sampleAnswer: "It's in the hallway closet, on the back wall. We had to use it once when the kitchen outlets stopped working."
      },
      {
        question: "Do you have a storage unit?",
        sampleAnswer: "No, we don't have a separate storage unit. We use the basement storage area in our building for our bikes."
      },
      {
        question: "Where do you keep important documents?",
        sampleAnswer: "We keep them in a fireproof box in the bedroom closet. It has our passports, marriage certificate, and insurance papers."
      },
      {
        question: "Who handles maintenance issues?",
        sampleAnswer: "I usually call the landlord when something needs fixing. My spouse handles smaller things like changing light bulbs."
      },
      {
        question: "Where is your water heater?",
        sampleAnswer: "It's in the utility closet in the hallway. It's a tankless water heater that was installed last year."
      }
    ],
    checklist: [
      "Know where important documents are stored",
      "Remember storage locations for seasonal items",
      "Know utility panel locations",
      "Be clear on maintenance responsibilities",
      "Remember where bikes/large items are stored",
      "Know water heater and HVAC locations"
    ]
  },
  {
    id: "outdoor",
    title: "Outdoor Spaces: Don't Let These Questions Catch You Off Guard",
    description: "Balcony furniture, parking spots, plant details - officers ask about outdoor life to verify you actually live where you claim. Be ready",
    category: "home-living",
    pdfFileName: "Outdoor_Balcony_Backyard_Interview_Practice_Questions.pdf",
    questionCount: "30+",
    icon: "Trees",
    sampleQA: [
      {
        question: "Do you have a balcony or patio?",
        sampleAnswer: "We have a small balcony off the living room. It has two chairs and a small table where we sometimes have coffee."
      },
      {
        question: "Do you have any plants outside?",
        sampleAnswer: "Yes, we have three potted plants on the balcony - two tomato plants and some herbs like basil and mint."
      },
      {
        question: "Where do you park your car?",
        sampleAnswer: "We park in the building's underground garage, spot number 12. We also have a visitor pass for guests."
      },
      {
        question: "Do you have outdoor furniture?",
        sampleAnswer: "Just the two folding chairs and small table on the balcony. They're from Target, dark green color."
      },
      {
        question: "Who takes care of outdoor maintenance?",
        sampleAnswer: "The building management handles landscaping and snow removal. We just water our own plants."
      },
      {
        question: "Do you have a grill?",
        sampleAnswer: "No, our building doesn't allow grills on the balcony. We use the community grill in the courtyard sometimes."
      }
    ],
    checklist: [
      "Know outdoor furniture details",
      "Remember any plants or garden items",
      "Know parking arrangements",
      "Be clear on outdoor maintenance",
      "Remember balcony/patio setup",
      "Know building outdoor rules"
    ]
  },
  
  // ==================== DAILY LIFE & ROUTINE ====================
  {
    id: "daily-routine",
    title: "Daily Routine: The #1 Way to Prove Your Marriage is REAL",
    description: "Wake-up times, work schedules, who does dishes - your daily life tells your story. Get these details aligned or face tough follow-up questions",
    category: "daily-routine",
    pdfFileName: "Daily_Routine_Real_Life_Interview_Practice_Questions.pdf",
    questionCount: "60+",
    icon: "Clock",
    sampleQA: [
      {
        question: "What time do you usually wake up on weekdays?",
        sampleAnswer: "I wake up at 6:45 AM on weekdays. My alarm goes off then, and I usually hit snooze once before getting up at 7 AM."
      },
      {
        question: "Who leaves the house first?",
        sampleAnswer: "My spouse leaves first around 7:30 AM for work. I leave at about 8:15 AM after I've had coffee and breakfast."
      },
      {
        question: "How do you communicate during the day?",
        sampleAnswer: "We text throughout the day using WhatsApp. We usually check in during lunch around noon and after work at 5 PM."
      },
      {
        question: "What do you do after work?",
        sampleAnswer: "I usually get home around 5:45 PM. I change clothes, start dinner, and my spouse gets home around 6:30 PM."
      },
      {
        question: "Who does the dishes?",
        sampleAnswer: "I usually cook and my spouse does the dishes. We have a dishwasher but hand-wash the pots and pans."
      },
      {
        question: "What time do you go to bed?",
        sampleAnswer: "We're usually in bed by 10:30 PM on weekdays. We watch TV for about an hour before sleeping."
      }
    ],
    checklist: [
      "Know your daily schedule by hour",
      "Remember communication patterns",
      "Know your chore division",
      "Be clear on evening routines",
      "Remember who does what household tasks",
      "Know your weekend vs weekday differences"
    ]
  },
  {
    id: "closet-laundry",
    title: "Closet & Laundry: The Questions That Expose Everything",
    description: "Detergent brands, laundry days, closet organization - these 'boring' routines prove you share a life together. Don't underestimate them",
    category: "daily-routine",
    pdfFileName: "Closet_Clothing_Laundry_Interview_Practice_Questions.pdf",
    questionCount: "35+",
    icon: "Shirt",
    sampleQA: [
      {
        question: "What laundry detergent do you use?",
        sampleAnswer: "We use Tide Free & Gentle because my spouse has sensitive skin. It's the white bottle with blue cap from Costco."
      },
      {
        question: "Who does the laundry?",
        sampleAnswer: "I usually do laundry on Saturday mornings. My spouse helps fold on Sunday evenings while we watch TV."
      },
      {
        question: "Where do you keep dirty clothes?",
        sampleAnswer: "We have a hamper in the bedroom closet. Whites go in the left side, colors in the right side."
      },
      {
        question: "How often do you do laundry?",
        sampleAnswer: "I do laundry once a week, usually Saturday morning. We do about two loads - one for colors and one for whites."
      },
      {
        question: "Where do you store clean clothes?",
        sampleAnswer: "Shirts and pants go in the closet. Underwear and socks go in the dresser drawers. I use the top two drawers, my spouse uses the bottom two."
      },
      {
        question: "Do you separate lights and darks?",
        sampleAnswer: "Yes, we always separate them. We also wash towels separately because they need hotter water."
      }
    ],
    checklist: [
      "Know laundry detergent brand",
      "Remember laundry schedule",
      "Know closet organization",
      "Be clear on who puts away clothes",
      "Remember hamper locations",
      "Know your laundry sorting system"
    ]
  },
  {
    id: "car-driving",
    title: "Car & Commute: Transportation Questions That TRAP Couples",
    description: "Car make and model, parking spots, commute times, gas stations - officers verify your daily movement patterns. Know every detail",
    category: "daily-routine",
    pdfFileName: "Car_Driving_Routine_Parking_Interview_Practice_Questions.pdf",
    questionCount: "40+",
    icon: "Car",
    sampleQA: [
      {
        question: "What kind of car do you have?",
        sampleAnswer: "We have a 2019 Honda Civic, silver color. The license plate is ABC-1234. We bought it used in 2021."
      },
      {
        question: "Who drives more often?",
        sampleAnswer: "I drive more during the week for my commute. We take my spouse's car on weekends for errands because it's better on gas."
      },
      {
        question: "Where do you park?",
        sampleAnswer: "We park in our building's underground garage, space number 12. It's included in our rent."
      },
      {
        question: "How do you get to work?",
        sampleAnswer: "I drive about 20 minutes to my office. My spouse takes the subway - the Red Line to Downtown Crossing."
      },
      {
        question: "Who pays for gas?",
        sampleAnswer: "We each pay for gas in our own cars. I usually fill up on Sundays at the Shell station near our apartment."
      },
      {
        question: "Do you have car insurance?",
        sampleAnswer: "Yes, we have Geico. We're both on the same policy. It renews every six months, and I pay it online."
      }
    ],
    checklist: [
      "Know car make, model, year, and color",
      "Remember parking arrangements",
      "Know commute details",
      "Be clear on who drives when",
      "Remember car insurance details",
      "Know gas station and maintenance routines"
    ]
  },
  {
    id: "home-office",
    title: "Home Office: The Work-From-Home Questions You MUST Know",
    description: "Desk setup, work hours, video call routines - with remote work booming, officers ask about home offices. Have your answers ready",
    category: "daily-routine",
    pdfFileName: "Home_Office_Desk_Area_Interview_Practice_Questions.pdf",
    questionCount: "30+",
    icon: "Monitor",
    sampleQA: [
      {
        question: "Do you work from home?",
        sampleAnswer: "I work from home on Mondays and Fridays. My spouse works from home on Wednesdays. The other days we're in the office."
      },
      {
        question: "Where is your desk?",
        sampleAnswer: "I have a desk in the corner of the living room. It's a white IKEA desk with a monitor and laptop setup."
      },
      {
        question: "Do you share the workspace?",
        sampleAnswer: "We have separate workspaces. I use the desk in the living room, and my spouse uses the small desk in the bedroom."
      },
      {
        question: "What hours do you work from home?",
        sampleAnswer: "I'm usually at my desk from 9 AM to 5 PM with a lunch break around noon. My spouse has similar hours."
      },
      {
        question: "Where do you keep work documents?",
        sampleAnswer: "I keep them in a filing cabinet next to my desk. My spouse uses Google Drive for most things."
      },
      {
        question: "Do you have video calls?",
        sampleAnswer: "Yes, I have Zoom meetings a few times a week. I use headphones so I don't disturb my spouse."
      }
    ],
    checklist: [
      "Know desk setup details",
      "Remember work-from-home schedule",
      "Know where work materials are stored",
      "Be clear on shared workspace rules",
      "Remember work hours",
      "Know video call routines"
    ]
  },
  
  // ==================== RELATIONSHIP & HISTORY ====================
  {
    id: "relationship-timeline",
    title: "Relationship Timeline: Your Love Story Under the Microscope",
    description: "When you met, first date, 'I love you' moment - your love story MUST be consistent. Any discrepancy raises instant suspicion. Practice until perfect",
    category: "relationship",
    pdfFileName: "Relationship_Timeline_How_It_Started_Interview_Practice_Questions.pdf",
    questionCount: "70+",
    icon: "Sparkles",
    sampleQA: [
      {
        question: "When and where did you first meet?",
        sampleAnswer: "We met at a mutual friend's birthday party on July 15, 2018, at a restaurant called The Garden in downtown Boston. It was a Saturday evening."
      },
      {
        question: "Who said 'I love you' first?",
        sampleAnswer: "I said it first, about three months after we started dating. We were walking in the Boston Common park on a Saturday afternoon in October."
      },
      {
        question: "When did you move in together?",
        sampleAnswer: "We moved in together in March 2020, right before the pandemic. We found an apartment in Cambridge and moved in on March 1st."
      },
      {
        question: "How did you meet?",
        sampleAnswer: "We were introduced by our friend Jessica at her birthday party. We started talking about our shared interest in hiking and exchanged numbers that night."
      },
      {
        question: "When did you start dating?",
        sampleAnswer: "We went on our first date the week after we met, on July 22, 2018. We became exclusive about a month later in August."
      },
      {
        question: "When did you know you wanted to get married?",
        sampleAnswer: "We started seriously talking about marriage in early 2020, about a year and a half after we started dating. We both knew after living together for a few months."
      }
    ],
    checklist: [
      "Know exact date and location you met",
      "Remember key relationship milestones",
      "Know proposal details",
      "Be consistent on timeline with your partner",
      "Remember who introduced you",
      "Know when you said 'I love you'"
    ]
  },
  {
    id: "wedding-celebrations",
    title: "Wedding Day: The Questions EVERY Officer Asks",
    description: "Date, location, guests, what you wore - your wedding details should be crystal clear. Hesitation here is a major red flag. Master this topic",
    category: "relationship",
    pdfFileName: "Wedding_and_Celebrations_Interview_Practice_Questions.pdf",
    questionCount: "50+",
    icon: "CircleDot",
    sampleQA: [
      {
        question: "When did you get married?",
        sampleAnswer: "We got married on June 12, 2021, at the City Hall in Boston. It was a Saturday morning ceremony at 10 AM."
      },
      {
        question: "Who was at your wedding?",
        sampleAnswer: "We had about 15 people - our parents, siblings, and a few close friends. My best friend Maria was my witness."
      },
      {
        question: "Where did you have your reception?",
        sampleAnswer: "After the City Hall ceremony, we went to a restaurant called Oleana in Cambridge for lunch with our families."
      },
      {
        question: "What did you wear?",
        sampleAnswer: "I wore a navy blue suit with a white shirt. My spouse wore a white dress that we bought from BHLDN."
      },
      {
        question: "Did you have a honeymoon?",
        sampleAnswer: "Yes, we went to Maine for a long weekend right after the wedding. We stayed in a cabin near Bar Harbor for four days."
      },
      {
        question: "Who officiated your wedding?",
        sampleAnswer: "A judge at Boston City Hall performed the ceremony. It was short but meaningful, about 15 minutes."
      }
    ],
    checklist: [
      "Know exact wedding date and location",
      "Remember who attended",
      "Know what you wore",
      "Be clear on reception details",
      "Remember honeymoon details",
      "Know who officiated"
    ]
  },
  {
    id: "anniversaries-holidays",
    title: "Holidays & Traditions: How You Celebrate Reveals Your Bond",
    description: "Anniversary gifts, birthday traditions, holiday plans - how you celebrate shows your commitment. Officers ask about these 'special moments' constantly",
    category: "relationship",
    pdfFileName: "Anniversaries_Birthdays_Holidays_Traditions_Interview_Practice_Questions.pdf",
    questionCount: "40+",
    icon: "Gift",
    sampleQA: [
      {
        question: "What did you do for your last anniversary?",
        sampleAnswer: "For our second anniversary in June 2023, we went to a nice Italian restaurant called Giacomo's and exchanged gifts. I got my spouse a watch."
      },
      {
        question: "How do you celebrate birthdays?",
        sampleAnswer: "We usually celebrate with a nice dinner at the person's favorite restaurant and a small cake at home with candles."
      },
      {
        question: "Where do you spend holidays?",
        sampleAnswer: "We alternate Thanksgiving between our families. Christmas Eve is with my family, and Christmas Day is with my spouse's family."
      },
      {
        question: "What did you get your spouse for their last birthday?",
        sampleAnswer: "I got my spouse a new pair of running shoes and made them breakfast in bed. We went hiking that afternoon."
      },
      {
        question: "Do you have any traditions?",
        sampleAnswer: "Every Sunday morning we get bagels from our favorite place and eat them together. We've done this since we moved in together."
      },
      {
        question: "How do you celebrate New Year's?",
        sampleAnswer: "We usually stay home, make a nice dinner, and watch the ball drop on TV. Last year we had some friends over."
      }
    ],
    checklist: [
      "Know how you celebrate anniversaries",
      "Remember birthday traditions",
      "Know holiday plans",
      "Be clear on gift-giving patterns",
      "Remember your special traditions",
      "Know how you spend major holidays"
    ]
  },
  {
    id: "travel-vacations",
    title: "Travel & Vacations: Your Shared Adventures Under Review",
    description: "Last trip, passport locations, favorite destinations - travel memories prove shared experiences. Officers love asking about vacations. Be prepared",
    category: "relationship",
    pdfFileName: "Travel_and_Vacations_Interview_Practice_Questions.pdf",
    questionCount: "45+",
    icon: "Plane",
    sampleQA: [
      {
        question: "What was your last trip together?",
        sampleAnswer: "Our last trip was to Miami in December 2023. We stayed for 5 days to celebrate the New Year with friends who live there."
      },
      {
        question: "Where do you keep your passports?",
        sampleAnswer: "We keep our passports in the fireproof box in the bedroom closet, along with other important documents."
      },
      {
        question: "Where have you traveled together?",
        sampleAnswer: "We've been to Miami, New York, Maine for our honeymoon, and Chicago to visit my spouse's sister."
      },
      {
        question: "Who plans your trips?",
        sampleAnswer: "I usually research hotels and flights, and my spouse plans the activities and restaurants. We book everything together."
      },
      {
        question: "Do you prefer beach or mountain vacations?",
        sampleAnswer: "We both prefer beach vacations, but we also enjoy hiking trips. We try to do one of each per year."
      },
      {
        question: "What was your favorite trip?",
        sampleAnswer: "Our honeymoon in Maine was our favorite. It was peaceful and beautiful, and we had great weather."
      }
    ],
    checklist: [
      "Remember your last few trips",
      "Know where travel documents are kept",
      "Remember trip details (dates, hotels)",
      "Be clear on who plans trips",
      "Know your travel preferences",
      "Remember favorite destinations"
    ]
  },
  
  // ==================== FINANCIAL & LEGAL ====================
  {
    id: "money-bills",
    title: "Money & Bills: Financial Proof That Saves Your Case",
    description: "Joint accounts, rent amount, who pays utilities - financial commingling is CRITICAL proof. These questions can make or break your approval",
    category: "financial",
    pdfFileName: "Money_Bills_Shared_Responsibilities_Interview_Practice_Questions.pdf",
    questionCount: "60+",
    icon: "CreditCard",
    sampleQA: [
      {
        question: "Do you have joint bank accounts?",
        sampleAnswer: "Yes, we have a joint checking account at Chase Bank that we use for rent and shared expenses. We also keep separate accounts for personal spending."
      },
      {
        question: "How much is your rent?",
        sampleAnswer: "Our rent is $2,400 per month. It's due on the 1st, and I usually pay it through the online portal using our joint account."
      },
      {
        question: "Who pays the utilities?",
        sampleAnswer: "I pay the electric and internet bills. My spouse pays the gas bill. We split them roughly evenly - about $150 total per month."
      },
      {
        question: "How do you split expenses?",
        sampleAnswer: "We put equal amounts into our joint account each month for shared expenses. Personal spending comes from our individual accounts."
      },
      {
        question: "What subscriptions do you have?",
        sampleAnswer: "We share Netflix, Hulu, and Spotify. They're all on my credit card, and my spouse pays me back through Venmo."
      },
      {
        question: "Who manages the finances?",
        sampleAnswer: "I mostly handle paying bills and tracking expenses, but we discuss major purchases together. My spouse handles the investments."
      }
    ],
    checklist: [
      "Know all account details (banks, types)",
      "Remember rent/mortgage amount and due date",
      "Know who pays which bills",
      "Be clear on expense splitting agreement",
      "Remember subscription services",
      "Know who manages finances"
    ]
  },
  {
    id: "insurance-healthcare",
    title: "Insurance & Healthcare: The Proof You're Truly Together",
    description: "Health plans, doctor names, emergency contacts - being on each other's insurance is powerful evidence. Know these details inside out",
    category: "financial",
    pdfFileName: "Insurance_and_Healthcare_Interview_Practice_Questions.pdf",
    questionCount: "50+",
    icon: "HeartPulse",
    sampleQA: [
      {
        question: "Do you have health insurance?",
        sampleAnswer: "Yes, we're both on my spouse's employer plan through Blue Cross Blue Shield. The card is in my spouse's wallet."
      },
      {
        question: "Who is your primary care doctor?",
        sampleAnswer: "My primary care doctor is Dr. Sarah Johnson at Cambridge Health Associates on Mass Ave. I last saw her in October 2023."
      },
      {
        question: "Who is listed as your emergency contact?",
        sampleAnswer: "I list my spouse as my emergency contact at work and at the doctor's office. My spouse lists me as well."
      },
      {
        question: "Where is your pharmacy?",
        sampleAnswer: "We use the CVS on Main Street, about two blocks from our apartment. We both get our prescriptions filled there."
      },
      {
        question: "Do you have dental insurance?",
        sampleAnswer: "Yes, it's included with my spouse's health insurance. We both go to Dr. Chen's dental office in Back Bay."
      },
      {
        question: "When was your last doctor visit?",
        sampleAnswer: "I had my annual physical in October 2023. My spouse had theirs in November. We usually schedule them around the same time."
      }
    ],
    checklist: [
      "Know insurance provider and plan details",
      "Remember doctor names and last visits",
      "Know where insurance cards are kept",
      "Be clear on emergency contacts",
      "Remember pharmacy location",
      "Know dental insurance details"
    ]
  },
  {
    id: "work-income",
    title: "Work & Career: Your Professional Lives Under Scrutiny",
    description: "Employer names, work schedules, job duties - officers verify your daily routines through work questions. Know each other's jobs perfectly",
    category: "financial",
    pdfFileName: "Work_and_Income_Basics_Interview_Practice_Questions.pdf",
    questionCount: "40+",
    icon: "Briefcase",
    sampleQA: [
      {
        question: "Where do you work?",
        sampleAnswer: "I work at Tech Solutions Inc. as a software developer. I've been there since January 2019. The office is in downtown Boston."
      },
      {
        question: "What are your work hours?",
        sampleAnswer: "I work Monday through Friday, 9 AM to 5 PM. Sometimes I work from home on Fridays, depending on meetings."
      },
      {
        question: "Where does your spouse work?",
        sampleAnswer: "My spouse works at City General Hospital as a registered nurse in the pediatric department. They've been there for three years."
      },
      {
        question: "What is your job title?",
        sampleAnswer: "I'm a Senior Software Developer. I work on web applications for our clients, mostly using React and Node.js."
      },
      {
        question: "How long have you worked there?",
        sampleAnswer: "I've been at Tech Solutions for about 5 years now. I started in January 2019 right after I finished my previous job."
      },
      {
        question: "Does your spouse work full-time?",
        sampleAnswer: "Yes, my spouse works full-time, 36 hours a week as a nurse. They work three 12-hour shifts, usually Tuesday, Wednesday, and Thursday."
      }
    ],
    checklist: [
      "Know employer names and addresses",
      "Remember work schedules",
      "Know job titles and duties",
      "Be clear on how long at current job",
      "Remember spouse's work details",
      "Know if you work from home"
    ]
  },
  {
    id: "address-history",
    title: "Address History: Every Move You've Made MATTERS",
    description: "Current address, previous homes, lease details, move-in dates - your housing history must be consistent with your application. No exceptions",
    category: "financial",
    pdfFileName: "Address_History_and_Moves_Interview_Practice_Questions.pdf",
    questionCount: "55+",
    icon: "MapPin",
    sampleQA: [
      {
        question: "What is your current address?",
        sampleAnswer: "We live at 123 Main Street, Apartment 4B, Boston, MA 02101. We moved here in March 2022."
      },
      {
        question: "Where did you live before this?",
        sampleAnswer: "Before this, we lived at 456 Oak Avenue in Cambridge from June 2020 to February 2022. It was a one-bedroom apartment."
      },
      {
        question: "Whose name is on the lease?",
        sampleAnswer: "Both of our names are on the current lease. At the previous apartment, only my name was on the lease because my spouse moved in later."
      },
      {
        question: "How long have you lived at your current address?",
        sampleAnswer: "We've lived here for about 2 years now. We moved in March 2022, so it's been since then."
      },
      {
        question: "Why did you move to your current address?",
        sampleAnswer: "We wanted a bigger place with two bedrooms, and this apartment was closer to both of our jobs. It also has better amenities."
      },
      {
        question: "Do you have a lease or month-to-month?",
        sampleAnswer: "We have a one-year lease that renews every March. We're currently in our second year here."
      }
    ],
    checklist: [
      "Know all addresses from last 5 years",
      "Remember move-in and move-out dates",
      "Know whose name was on each lease",
      "Be clear on reasons for moving",
      "Remember lease terms",
      "Know how long at each address"
    ]
  },
  
  // ==================== FAMILY & SOCIAL ====================
  {
    id: "family-inlaws",
    title: "Family & In-Laws: Social Proof of Your Real Marriage",
    description: "Parents' names, sibling details, closest friends - knowing each other's family proves genuine integration. Officers dig deep into your social circle",
    category: "family-social",
    pdfFileName: "Family_InLaws_Social_Circle_Interview_Practice_Questions.pdf",
    questionCount: "50+",
    icon: "Users",
    sampleQA: [
      {
        question: "Have you met each other's parents?",
        sampleAnswer: "Yes, I've met my spouse's parents multiple times. They live in New York, and we visit during holidays. My parents live in Boston, so we see them more often, about once a month."
      },
      {
        question: "Who are your closest friends?",
        sampleAnswer: "Our closest friends are Maria and David. We've known them since college, and we usually have dinner with them once a month. They live in Somerville."
      },
      {
        question: "What are your parents' names?",
        sampleAnswer: "My parents are Robert and Linda. My spouse's parents are Michael and Susan. We call them Mom and Dad."
      },
      {
        question: "Do you have siblings?",
        sampleAnswer: "I have one younger sister named Emily. She lives in Chicago. My spouse has an older brother named James who lives here in Boston."
      },
      {
        question: "How often do you see your families?",
        sampleAnswer: "We see my parents about once a month for dinner. We see my spouse's parents every few months when we visit New York or they come here."
      },
      {
        question: "Do your parents get along?",
        sampleAnswer: "Yes, they've met a few times at our wedding and holiday gatherings. They seem to like each other and exchange cards at Christmas."
      }
    ],
    checklist: [
      "Know parents' names and locations",
      "Remember sibling details",
      "Know your closest friends",
      "Be clear on how often you see family",
      "Remember in-laws' names",
      "Know family dynamics"
    ]
  },
  {
    id: "community-ties",
    title: "Community Ties: Your Life Beyond the Front Door",
    description: "Neighbors, local spots, community involvement - your life extends beyond home. Officers ask about your community to verify genuine residence",
    category: "family-social",
    pdfFileName: "Community_Ties_Interview_Practice_Questions.pdf",
    questionCount: "35+",
    icon: "Building2",
    sampleQA: [
      {
        question: "Do you know your neighbors?",
        sampleAnswer: "Yes, we know Mrs. Chen in 4A and the young couple in 4C. We say hello in the hallway and sometimes chat in the elevator."
      },
      {
        question: "Where do you go for groceries?",
        sampleAnswer: "We usually go to Trader Joe's on Boylston Street. It's about a 10-minute walk from our apartment."
      },
      {
        question: "Do you go to church or religious services?",
        sampleAnswer: "We go to the Unitarian church near our apartment about twice a month. We also attend services on major holidays."
      },
      {
        question: "Are you involved in any community groups?",
        sampleAnswer: "I'm part of a local running club that meets on Saturday mornings. My spouse volunteers at the animal shelter once a month."
      },
      {
        question: "Where do you work out?",
        sampleAnswer: "We have memberships at the YMCA near our apartment. I go in the mornings, and my spouse goes after work."
      },
      {
        question: "Do you have a favorite local restaurant?",
        sampleAnswer: "Yes, we love this Thai place called Brown Sugar on Commonwealth Avenue. We go there almost every other week."
      }
    ],
    checklist: [
      "Know your neighbors",
      "Remember community activities",
      "Know local places you frequent",
      "Be clear on involvement in neighborhood",
      "Remember gym or exercise routines",
      "Know favorite local businesses"
    ]
  },
  {
    id: "children-custody",
    title: "Children & Parenting: Family Planning Questions EXPOSED",
    description: "Kids, parenting styles, future plans - children are a major topic if applicable. Be aligned on your family vision and any existing arrangements",
    category: "family-social",
    pdfFileName: "Children_Custody_Parenting_Plans_Interview_Practice_Questions.pdf",
    questionCount: "45+",
    icon: "Baby",
    sampleQA: [
      {
        question: "Do you have any children?",
        sampleAnswer: "No, we don't have children yet. We're planning to start a family in the next few years after we're more settled."
      },
      {
        question: "Do you want to have children?",
        sampleAnswer: "Yes, we both want children. We've talked about having two kids, maybe starting in a year or two."
      },
      {
        question: "Does either of you have children from a previous relationship?",
        sampleAnswer: "No, neither of us has children from previous relationships. This is our first marriage for both of us."
      },
      {
        question: "Have you discussed parenting styles?",
        sampleAnswer: "Yes, we've talked about it. We both want to be involved parents and share responsibilities equally."
      },
      {
        question: "Do your families pressure you about having kids?",
        sampleAnswer: "Not really. Our parents have mentioned it a few times, but they respect our timeline and decisions."
      },
      {
        question: "Have you thought about names?",
        sampleAnswer: "We've joked about names but haven't seriously decided. We want to wait until we're actually expecting."
      }
    ],
    checklist: [
      "Know your plans for children",
      "Remember discussions about parenting",
      "Know if there are children from previous relationships",
      "Be clear on family pressure/opinions",
      "Remember timeline for starting a family",
      "Know each other's views on parenting"
    ]
  },
  {
    id: "conflict-resolution",
    title: "Conflict & Decisions: How You Handle Problems Matters",
    description: "Decision-making, disagreements, compromises - real couples have conflicts. Officers ask how you resolve issues to assess relationship authenticity",
    category: "family-social",
    pdfFileName: "Conflict_Resolution_Household_Decisions_Interview_Practice_Questions.pdf",
    questionCount: "30+",
    icon: "Handshake",
    sampleQA: [
      {
        question: "How do you make major decisions?",
        sampleAnswer: "We discuss major decisions together and try to reach an agreement. For big purchases over $200, we always talk about it first."
      },
      {
        question: "How do you handle disagreements?",
        sampleAnswer: "We try to talk things through calmly. If we get too heated, we take a break and come back to it later. We never go to bed angry."
      },
      {
        question: "Who makes decisions about the home?",
        sampleAnswer: "We make decisions together. I handle more of the day-to-day stuff, but we discuss big changes like furniture or renovations."
      },
      {
        question: "Have you ever had a big fight?",
        sampleAnswer: "We've had disagreements like any couple, but nothing major. We communicate well and try to understand each other's perspective."
      },
      {
        question: "Who decides what to eat for dinner?",
        sampleAnswer: "Whoever is cooking usually decides, but we check with each other. If we're both tired, we might order takeout."
      },
      {
        question: "How do you compromise?",
        sampleAnswer: "We try to find solutions that work for both of us. Sometimes we take turns choosing, like I pick the movie this time, my spouse picks next time."
      }
    ],
    checklist: [
      "Know how you make decisions",
      "Remember how you handle disagreements",
      "Know division of responsibilities",
      "Be clear on communication style",
      "Remember compromise strategies",
      "Know how you resolve conflicts"
    ]
  },
  
  // ==================== TECHNOLOGY & COMMUNICATION ====================
  {
    id: "phones-digital",
    title: "Phones & Digital Life: Your Connected World Revealed",
    description: "Phone plans, texting apps, social media, shared accounts - your digital footprint shows connection patterns. Officers ask about your tech life constantly",
    category: "tech-communication",
    pdfFileName: "Phones_and_Digital_Life_Interview_Practice_Questions.pdf",
    questionCount: "40+",
    icon: "Smartphone",
    sampleQA: [
      {
        question: "What phone provider do you use?",
        sampleAnswer: "We both use Verizon. We're on a family plan together with unlimited data. The bill is about $120 per month."
      },
      {
        question: "How do you communicate with each other?",
        sampleAnswer: "We mainly text using WhatsApp and sometimes call during the day. We also share our locations with each other through the Find My app."
      },
      {
        question: "Do you share passwords?",
        sampleAnswer: "We know each other's phone passwords and some account passwords. It's more for convenience than anything else."
      },
      {
        question: "What social media do you use?",
        sampleAnswer: "We're both on Instagram and Facebook. We post photos of our trips and tag each other. My spouse also uses Twitter."
      },
      {
        question: "Do you have shared accounts?",
        sampleAnswer: "We share Netflix, Hulu, Spotify, and Amazon Prime. They're mostly on my accounts, and we split the costs."
      },
      {
        question: "How often do you text during the day?",
        sampleAnswer: "We text a few times a day - usually good morning, checking in at lunch, and after work. Maybe 5-10 messages total."
      }
    ],
    checklist: [
      "Know phone providers and plans",
      "Remember apps you use to communicate",
      "Know social media accounts",
      "Be clear on shared digital accounts",
      "Remember password sharing",
      "Know your daily communication patterns"
    ]
  },
  {
    id: "evidence-shared-life",
    title: "Evidence of Shared Life: Documentation That WINS Cases",
    description: "Photos, documents, travel proof, saved cards - having evidence is one thing, knowing what you have is another. Be ready to describe your proof",
    category: "tech-communication",
    pdfFileName: "Evidence_of_Shared_Life_Interview_Practice_Questions.pdf",
    questionCount: "35+",
    icon: "Camera",
    sampleQA: [
      {
        question: "Do you have photos together?",
        sampleAnswer: "Yes, we have lots of photos on our phones and in a shared Google Photos album. We have pictures from trips, holidays, and everyday moments."
      },
      {
        question: "What evidence do you have of your relationship?",
        sampleAnswer: "We have photos, joint bank statements, our lease with both names, utility bills, and cards we've given each other."
      },
      {
        question: "Do you have photos from your wedding?",
        sampleAnswer: "Yes, we have photos from our City Hall ceremony and the lunch afterward. Our friend Maria took most of them."
      },
      {
        question: "Where do you keep important documents?",
        sampleAnswer: "We keep them in a fireproof document box in the bedroom closet. It has our marriage certificate, passports, and insurance papers."
      },
      {
        question: "Do you have travel documents together?",
        sampleAnswer: "Yes, we have boarding passes and hotel confirmations from trips we've taken together. We keep them in a folder with our other documents."
      },
      {
        question: "Have you saved cards or letters?",
        sampleAnswer: "Yes, we've saved birthday cards, anniversary cards, and some notes we've written to each other. They're in a box under the bed."
      }
    ],
    checklist: [
      "Know what photos you have together",
      "Remember important dates with evidence",
      "Know where documents are stored",
      "Be clear on joint account statements",
      "Remember travel documentation",
      "Know what cards/letters you've saved"
    ]
  },
  
  // ==================== SPECIAL PRACTICE ====================
  {
    id: "rapid-fire",
    title: "Rapid-Fire Drill: Can You Handle the Pressure?",
    description: "50 lightning-fast questions that test your memory and consistency. Officers fire questions rapidly - practice until your answers are automatic",
    category: "special-practice",
    pdfFileName: "Rapid_Fire_Memory_Test_Drill_50_Questions.pdf",
    questionCount: "50",
    icon: "Zap",
    sampleQA: [
      {
        question: "What side of the bed do you sleep on?",
        sampleAnswer: "I sleep on the left side, near the window. My spouse sleeps on the right side."
      },
      {
        question: "What did you eat for breakfast today?",
        sampleAnswer: "I had oatmeal with bananas and coffee. My spouse had toast with peanut butter."
      },
      {
        question: "What color is your toothbrush?",
        sampleAnswer: "Mine is blue, and my spouse's is green. We keep them in a cup on the sink."
      },
      {
        question: "When is your anniversary?",
        sampleAnswer: "Our wedding anniversary is June 12, 2021. We just celebrated our third anniversary."
      },
      {
        question: "Who takes out the trash?",
        sampleAnswer: "I take it out on Tuesdays and Fridays. My spouse takes it out on Sundays."
      },
      {
        question: "What time did you wake up today?",
        sampleAnswer: "I woke up at 6:45 AM when my alarm went off. My spouse woke up at 7 AM."
      }
    ],
    checklist: [
      "Practice answering quickly",
      "Don't pause too long",
      "Say 'I don't remember' if unsure",
      "Stay calm under pressure",
      "Review daily details each morning",
      "Quiz each other randomly"
    ]
  },
  {
    id: "red-flag",
    title: "Red-Flag Topics: The Questions That END Cases",
    description: "Prior marriages, legal issues, immigration history - these sensitive topics can derail your case. Answer carefully, truthfully, and consistently",
    category: "special-practice",
    pdfFileName: "Red_Flag_Consistency_Topics_Interview_Practice_Questions.pdf",
    questionCount: "40+",
    icon: "AlertTriangle",
    sampleQA: [
      {
        question: "Have either of you been married before?",
        sampleAnswer: "No, this is our first marriage for both of us. Neither of us has been married before."
      },
      {
        question: "Have you ever lived apart since getting married?",
        sampleAnswer: "No, we've lived together continuously since we got married. We moved into our current apartment together in March 2022."
      },
      {
        question: "Have either of you been arrested?",
        sampleAnswer: "No, neither of us has ever been arrested or had any legal issues."
      },
      {
        question: "Did you ever use a different address on immigration forms?",
        sampleAnswer: "No, we've always used our current address on all forms since we filed the petition."
      },
      {
        question: "Have you filed any other immigration petitions?",
        sampleAnswer: "No, this is the first immigration petition we've filed."
      },
      {
        question: "Have either of you ever been denied a visa?",
        sampleAnswer: "No, neither of us has ever been denied a visa or had any immigration issues."
      }
    ],
    checklist: [
      "Review prior relationships honestly",
      "Know any gaps in living together",
      "Remember any legal issues",
      "Be consistent with your partner",
      "Know what you put on all forms",
      "Be truthful about immigration history"
    ]
  }
];

export const getTopicsByCategory = (categoryId: string): Topic[] => {
  return topics.filter(topic => topic.category === categoryId);
};

export const getTopicById = (id: string): Topic | undefined => {
  return topics.find(topic => topic.id === id);
};

export const getCategoryById = (id: string): Category | undefined => {
  return categories.find(cat => cat.id === id);
};

// Testimonials data
export interface Testimonial {
  id: string;
  names: string;
  location: string;
  quote: string;
  result: string;
  date: string;
}

export const testimonials: Testimonial[] = [
  {
    id: "1",
    names: "Maria & James",
    location: "California",
    quote: "These practice questions helped us discover details we had never discussed! The kitchen and daily routine questions were especially helpful. We felt so much more confident going into our interview.",
    result: "Approved on the spot",
    date: "March 2024"
  },
  {
    id: "2",
    names: "Priya & David",
    location: "Texas",
    quote: "We practiced every night for two weeks using these PDFs. The rapid-fire drill was a game-changer - it prepared us for the fast-paced nature of the actual interview.",
    result: "Approved in 3 months",
    date: "January 2024"
  },
  {
    id: "3",
    names: "Ana & Michael",
    location: "New York",
    quote: "The relationship timeline questions made us realize we needed to align on some dates. We're so glad we practiced beforehand instead of finding out during the interview!",
    result: "Approved on the spot",
    date: "December 2023"
  },
  {
    id: "4",
    names: "Yuki & Robert",
    location: "Washington",
    quote: "Having sample answers as a guide was incredibly helpful. It showed us the level of detail we should provide without over-sharing. The checklist feature kept us organized.",
    result: "Approved in 2 months",
    date: "February 2024"
  },
  {
    id: "5",
    names: "Sofia & Thomas",
    location: "Florida",
    quote: "The timeline builder tool helped us document our entire relationship journey. When the officer asked about our first date, we both had the same answer ready.",
    result: "Approved on the spot",
    date: "November 2023"
  }
];

// Timeline milestone templates
export interface TimelineMilestone {
  id: string;
  title: string;
  date: string;
  location: string;
  notes: string;
  hasEvidence: boolean;
}

export const defaultMilestones: Omit<TimelineMilestone, 'id'>[] = [
  { title: "First Met", date: "", location: "", notes: "", hasEvidence: false },
  { title: "First Date", date: "", location: "", notes: "", hasEvidence: false },
  { title: "Started Dating Exclusively", date: "", location: "", notes: "", hasEvidence: false },
  { title: "Said 'I Love You'", date: "", location: "", notes: "", hasEvidence: false },
  { title: "Met Each Other's Parents", date: "", location: "", notes: "", hasEvidence: false },
  { title: "First Trip Together", date: "", location: "", notes: "", hasEvidence: false },
  { title: "Moved In Together", date: "", location: "", notes: "", hasEvidence: false },
  { title: "Got Engaged", date: "", location: "", notes: "", hasEvidence: false },
  { title: "Got Married", date: "", location: "", notes: "", hasEvidence: false },
  { title: "Filed Immigration Petition", date: "", location: "", notes: "", hasEvidence: false }
];
