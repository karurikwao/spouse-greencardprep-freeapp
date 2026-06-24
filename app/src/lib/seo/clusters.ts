/**
 * Topic Cluster SEO Framework
 * 
 * Defines the content cluster structure for marriage-based green card interview preparation.
 * This framework supports scalable expansion to 200-500 quality pages.
 * 
 * Cluster Structure:
 * - Pillar Page: Broad topic authority page
 * - Supporting Pages: Specific subtopic pages that link to pillar
 * - Internal Linking: Strong bidirectional linking between pillar and supporting pages
 */

// ============================================================================
// TYPES
// ============================================================================

export interface ContentCluster {
  id: string;
  slug: string;
  name: string;
  shortName: string;
  description: string;
  pillarPage: PillarPageConfig;
  supportingPages: SupportingPageConfig[];
}

export interface PillarPageConfig {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  keywords: string[];
  sections: PillarSection[];
}

export interface PillarSection {
  id: string;
  title: string;
  content: string;
  linkToSupporting?: string[]; // slugs of supporting pages to link
}

export interface SupportingPageConfig {
  slug: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  h1: string;
  keywords: string[];
  relatedQuestions: string[]; // question prompts or slugs
  parentCluster: string; // cluster id
  contentSections: SupportingSection[];
}

export interface SupportingSection {
  id: string;
  title: string;
  content: string;
  hasExampleAnswer?: boolean;
  hasCommonMistakes?: boolean;
}

// ============================================================================
// CLUSTER 1: RELATIONSHIP HISTORY
// ============================================================================

const relationshipHistoryCluster: ContentCluster = {
  id: 'relationship-history',
  slug: 'relationship-history',
  name: 'Relationship History',
  shortName: 'Relationship',
  description: 'Questions about how you met, dating, engagement, and relationship milestones',
  
  pillarPage: {
    slug: 'uscis-marriage-interview-questions-about-relationship-history',
    title: 'USCIS Marriage Interview Questions About Relationship History',
    metaTitle: 'USCIS Marriage Interview Questions About Relationship History | Green Card Prep',
    metaDescription: 'Prepare for USCIS marriage interview questions about your relationship history. Learn how to answer questions about how you met, dating, engagement, and your journey together.',
    h1: 'USCIS Marriage Interview Questions About Relationship History',
    keywords: [
      'USCIS marriage interview questions',
      'marriage green card interview questions',
      'relationship history interview questions',
      'how did you meet USCIS question',
      'green card interview questions for couples'
    ],
    sections: [
      {
        id: 'why-ask',
        title: 'Why Officers Ask About Your Relationship History',
        content: 'USCIS officers ask about your relationship history to verify that your marriage is genuine and not solely for immigration purposes. They want to see that you have a real relationship built over time with shared experiences, milestones, and memories.'
      },
      {
        id: 'how-we-met',
        title: 'How Did You Meet?',
        content: 'One of the most common opening questions is about how you and your spouse met. Officers want to hear a natural story with specific details about where, when, and under what circumstances you first encountered each other.',
        linkToSupporting: ['how-did-you-meet-your-spouse-uscis-interview']
      },
      {
        id: 'dating-relationship',
        title: 'Your Dating Relationship',
        content: 'Officers may ask about your dating period—how often you saw each other, what you did together, when you decided to get serious, and how your relationship developed. These questions help establish the timeline of your relationship.'
      },
      {
        id: 'engagement-proposal',
        title: 'Engagement and Proposal',
        content: 'Questions about your engagement are common. When did you get engaged? How did the proposal happen? Who was present? These details help officers understand the progression of your relationship toward marriage.',
        linkToSupporting: ['marriage-interview-questions-about-your-proposal']
      },
      {
        id: 'common-mistakes',
        title: 'Common Mistakes to Avoid',
        content: 'Avoid giving vague answers like "we met online" without details. Don\'t memorize a script—officers can tell when answers sound rehearsed. Be prepared for follow-up questions that test the consistency of your story.'
      },
      {
        id: 'practice-together',
        title: 'How to Practice Together',
        content: 'Sit down with your spouse and create a relationship timeline. Talk through how you met, your first date, when you said "I love you," the proposal, and your wedding. Make sure your general timelines align while allowing for natural differences in memory.'
      }
    ]
  },
  
  supportingPages: [
    {
      slug: 'how-did-you-meet-your-spouse-uscis-interview',
      title: 'How Did You Meet Your Spouse? USCIS Interview Answer Guide',
      metaTitle: 'How Did You Meet Your Spouse? USCIS Interview Guide',
      metaDescription: 'Learn how to answer "How did you meet your spouse?" in your USCIS marriage interview. Get tips for different meeting scenarios and example answers.',
      h1: 'How Did You Meet Your Spouse? USCIS Interview Answer Guide',
      keywords: ['how did you meet your spouse', 'USCIS interview how we met', 'marriage interview meeting story'],
      parentCluster: 'relationship-history',
      relatedQuestions: ['How did you meet your spouse?', 'When did you first meet?'],
      contentSections: [
        {
          id: 'why-ask',
          title: 'Why Officers Ask This Question',
          content: 'This is often the first question in a marriage interview. Officers use it as an icebreaker while also assessing whether your meeting story sounds natural and genuine. They may circle back to details you mention to test consistency.'
        },
        {
          id: 'what-to-include',
          title: 'What to Include in Your Answer',
          content: 'A good answer includes: where you met (be specific), approximately when, who was present, what you were both doing at the time, and what your first impressions were. Keep it natural rather than memorized.'
        },
        {
          id: 'example-answers',
          title: 'Example Answers by Meeting Type',
          content: 'Different scenarios for how couples meet: through friends, at work, online dating, in school, at social events, or while traveling. Each scenario has different details officers may follow up on.',
          hasExampleAnswer: true
        },
        {
          id: 'common-mistakes',
          title: 'Common Mistakes to Avoid',
          content: 'Avoid being too vague ("we just met"), giving different years than your spouse, or sounding like you\'re reading from a script. If you met online, be comfortable discussing which platform and how your first in-person meeting went.',
          hasCommonMistakes: true
        }
      ]
    },
    {
      slug: 'marriage-interview-questions-about-your-proposal',
      title: 'Marriage Interview Questions About Your Proposal',
      metaTitle: 'Marriage Interview Questions About Your Proposal | USCIS Guide',
      metaDescription: 'Prepare for USCIS questions about your proposal. Learn what details to share and how to answer naturally about your engagement story.',
      h1: 'Marriage Interview Questions About Your Proposal',
      keywords: ['marriage interview proposal questions', 'USCIS engagement questions', 'green card interview proposal'],
      parentCluster: 'relationship-history',
      relatedQuestions: ['How did the proposal happen?', 'Were you expecting it?', 'Who was present?'],
      contentSections: [
        {
          id: 'why-ask',
          title: 'Why Officers Ask About Your Proposal',
          content: 'The proposal story reveals the emotional arc of your relationship. Officers want to see that your engagement was a meaningful milestone, not a formality for immigration purposes.'
        },
        {
          id: 'key-details',
          title: 'Key Details to Remember',
          content: 'Be prepared to share: when it happened (month/year), where you were, whether it was planned or spontaneous, who was present, what was said, and how you celebrated afterward.'
        },
        {
          id: 'example-answers',
          title: 'Example Proposal Stories',
          content: 'Examples of different proposal scenarios: private at-home proposals, public restaurant proposals, destination proposals, family-present proposals, and spontaneous proposals.',
          hasExampleAnswer: true
        },
        {
          id: 'follow-up-questions',
          title: 'Follow-Up Questions to Expect',
          content: 'Officers may ask: Did you tell anyone right away? Who designed the ring? How long were you engaged before setting a wedding date? These details test the depth of your shared experience.'
        }
      ]
    },
    {
      slug: 'uscis-interview-questions-about-dating',
      title: 'USCIS Interview Questions About Dating and Courtship',
      metaTitle: 'USCIS Interview Questions About Dating and Courtship',
      metaDescription: 'Prepare for USCIS questions about your dating relationship. Learn what officers ask about your courtship period and how to answer naturally.',
      h1: 'USCIS Interview Questions About Dating and Courtship',
      keywords: ['USCIS dating questions', 'courtship interview questions', 'relationship timeline USCIS'],
      parentCluster: 'relationship-history',
      relatedQuestions: ['How long did you date before getting engaged?', 'What did you do on dates?', 'When did you decide to get married?'],
      contentSections: [
        {
          id: 'timeline-importance',
          title: 'Why Your Dating Timeline Matters',
          content: 'Officers want to see a logical progression in your relationship. Dating for a reasonable period before engagement demonstrates a genuine relationship rather than a rushed marriage of convenience.'
        },
        {
          id: 'common-questions',
          title: 'Common Dating Questions',
          content: 'How often did you see each other? What did you typically do together? Did you meet each other\'s families during this time? When did you realize you wanted to get married?'
        },
        {
          id: 'long-distance',
          title: 'If You Had a Long-Distance Relationship',
          content: 'Be prepared to explain how you maintained the relationship, how often you visited, and what you did during visits. Officers may ask for evidence of trips like photos or travel records.'
        }
      ]
    }
  ]
};

// ============================================================================
// CLUSTER 2: WEDDING AND CEREMONY
// ============================================================================

const weddingCeremonyCluster: ContentCluster = {
  id: 'wedding-ceremony',
  slug: 'wedding-ceremony',
  name: 'Wedding and Ceremony',
  shortName: 'Wedding',
  description: 'Questions about your wedding ceremony, reception, guests, and celebration details',
  
  pillarPage: {
    slug: 'uscis-marriage-interview-questions-about-wedding-ceremony',
    title: 'USCIS Marriage Interview Questions About Your Wedding Ceremony',
    metaTitle: 'USCIS Marriage Interview Questions About Wedding Ceremony | Green Card Prep',
    metaDescription: 'Prepare for USCIS marriage interview questions about your wedding. Learn how to answer questions about your ceremony, reception, guests, and celebration details.',
    h1: 'USCIS Marriage Interview Questions About Your Wedding Ceremony',
    keywords: [
      'USCIS marriage interview questions',
      'wedding ceremony interview questions',
      'marriage green card interview questions',
      'green card interview wedding questions'
    ],
    sections: [
      {
        id: 'why-ask',
        title: 'Why Officers Ask About Your Wedding',
        content: 'Your wedding is a major milestone that genuine couples remember in detail. Officers ask about your ceremony, reception, and guests to verify that you actually celebrated your marriage together with people who know you as a couple.'
      },
      {
        id: 'ceremony-details',
        title: 'Questions About Your Ceremony',
        content: 'Officers may ask where your ceremony took place, who officiated, whether it was religious or civil, and what vows you exchanged. These questions establish the formal nature of your marriage.',
        linkToSupporting: ['marriage-interview-questions-about-your-wedding-ceremony']
      },
      {
        id: 'reception-guests',
        title: 'Reception and Wedding Guests',
        content: 'Questions about your reception—where it was, what food was served, who attended—help officers understand the social celebration of your marriage. Genuine weddings typically involve family and friends on both sides.'
      },
      {
        id: 'wedding-expenses',
        title: 'Who Paid for the Wedding',
        content: 'Officers sometimes ask about wedding expenses and who paid for various aspects. This helps establish the financial interdependence and family involvement characteristic of genuine marriages.'
      },
      {
        id: 'common-mistakes',
        title: 'Common Mistakes to Avoid',
        content: 'Don\'t claim a large guest list if you can\'t name anyone who attended. Be consistent about whether family members were present. If you had a small courthouse wedding, be comfortable explaining why.'
      },
      {
        id: 'prepare',
        title: 'How to Prepare Wedding Answers',
        content: 'Review your wedding photos together. Talk through the sequence of events, who was there, and memorable moments. If you had a small or courthouse wedding, discuss why that choice made sense for you.'
      }
    ]
  },
  
  supportingPages: [
    {
      slug: 'marriage-interview-questions-about-your-wedding-ceremony',
      title: 'Marriage Interview Questions About Your Wedding Ceremony',
      metaTitle: 'Marriage Interview Questions About Wedding Ceremony | USCIS',
      metaDescription: 'Prepare for USCIS questions about your wedding ceremony. Learn what details officers ask about and how to answer about religious vs civil ceremonies.',
      h1: 'Marriage Interview Questions About Your Wedding Ceremony',
      keywords: ['wedding ceremony interview questions', 'USCIS wedding questions', 'civil ceremony green card'],
      parentCluster: 'wedding-ceremony',
      relatedQuestions: ['Where did you get married?', 'Who officiated your wedding?', 'Was it a religious ceremony?'],
      contentSections: [
        {
          id: 'ceremony-types',
          title: 'Different Ceremony Types',
          content: 'Courthouse/civil ceremonies, religious ceremonies in churches/temples, destination weddings, backyard weddings, and small intimate ceremonies each have different details officers may explore.'
        },
        {
          id: 'courthouse-weddings',
          title: 'Answering About Courthouse Weddings',
          content: 'Many couples have courthouse weddings for practical reasons. Be prepared to explain why you chose this option, who witnessed it, and whether you had a separate celebration with family.'
        },
        {
          id: 'religious-ceremonies',
          title: 'Religious Ceremony Details',
          content: 'If you had a religious ceremony, officers may ask about the officiant, religious traditions observed, and whether both families participated in religious aspects of the wedding.'
        },
        {
          id: 'common-mistakes',
          title: 'Common Mistakes',
          content: 'Don\'t exaggerate the size or formality of your wedding. If it was small and simple, own that. Inconsistencies about whether parents attended, the date, or the location are red flags.',
          hasCommonMistakes: true
        }
      ]
    },
    {
      slug: 'uscis-interview-questions-about-wedding-guests',
      title: 'USCIS Interview Questions About Wedding Guests',
      metaTitle: 'USCIS Interview Questions About Wedding Guests | Green Card',
      metaDescription: 'Prepare for USCIS questions about your wedding guests. Learn how to answer about who attended your wedding and family participation.',
      h1: 'USCIS Interview Questions About Wedding Guests',
      keywords: ['wedding guests interview questions', 'USCIS wedding guest questions', 'family wedding attendance'],
      parentCluster: 'wedding-ceremony',
      relatedQuestions: ['Who attended your wedding?', 'Did your parents meet before the wedding?', 'How many guests were there?'],
      contentSections: [
        {
          id: 'why-ask',
          title: 'Why Officers Ask About Guests',
          content: 'Wedding attendance reveals the social integration of your families. Genuine marriages typically involve family members from both sides celebrating together.'
        },
        {
          id: 'family-meeting',
          title: 'Did Your Families Meet?',
          content: 'Officers often ask if your parents met before or at the wedding. If they didn\'t meet, be prepared to explain why (distance, timing, cultural factors) without making it sound like the families were unaware of the marriage.'
        },
        {
          id: 'guest-list-details',
          title: 'What Guest Details to Know',
          content: 'Have a general sense of how many guests attended, the ratio of your guests vs your spouse\'s guests, and whether key family members (parents, siblings) were present.'
        }
      ]
    }
  ]
};

// ============================================================================
// CLUSTER 3: LIVING TOGETHER
// ============================================================================

const livingTogetherCluster: ContentCluster = {
  id: 'living-together',
  slug: 'living-together',
  name: 'Living Together',
  shortName: 'Living',
  description: 'Questions about your home, daily routines, household details, and sleeping arrangements',
  
  pillarPage: {
    slug: 'uscis-marriage-interview-questions-about-living-together',
    title: 'USCIS Marriage Interview Questions About Living Together',
    metaTitle: 'USCIS Marriage Interview Questions About Living Together | Green Card',
    metaDescription: 'Prepare for USCIS marriage interview questions about living together. Learn how to answer questions about your home, daily routines, and household details.',
    h1: 'USCIS Marriage Interview Questions About Living Together',
    keywords: [
      'USCIS marriage interview questions',
      'living together interview questions',
      'marriage green card interview questions',
      'home life interview questions'
    ],
    sections: [
      {
        id: 'why-ask',
        title: 'Why Officers Ask About Your Home Life',
        content: 'Living together is a fundamental aspect of marriage. Officers ask detailed questions about your home, daily routines, and household arrangements to verify that you actually share a life together, not just a mailing address.'
      },
      {
        id: 'home-details',
        title: 'Questions About Your Home',
        content: 'Officers may ask about your address, type of residence, who lives there, bedroom arrangements, and details about your neighborhood. These questions establish that you genuinely cohabit.',
        linkToSupporting: ['green-card-interview-questions-about-your-home']
      },
      {
        id: 'daily-routines',
        title: 'Daily Routines and Schedules',
        content: 'Questions about who wakes up first, morning routines, meal times, and evening habits help officers understand the rhythm of your shared life. Genuine couples know each other\'s daily patterns.',
        linkToSupporting: ['green-card-interview-questions-about-daily-routines']
      },
      {
        id: 'household-chores',
        title: 'Household Responsibilities',
        content: 'Officers may ask who does which chores, how you divide responsibilities, and details about your kitchen, bathroom, and living spaces. These details are hard to fake convincingly.'
      },
      {
        id: 'living-apart',
        title: 'If You Are Living Apart Temporarily',
        content: 'Some couples live apart temporarily due to work, school, or immigration processing. Be prepared to explain the circumstances, how you maintain the relationship, and your plans to live together.'
      },
      {
        id: 'prepare',
        title: 'How to Prepare Together',
        content: 'Walk through your home together and notice details: which side of the bed, bathroom contents, kitchen appliances, closet space. Discuss your daily schedules and how you divide household tasks.'
      }
    ]
  },
  
  supportingPages: [
    {
      slug: 'green-card-interview-questions-about-your-home',
      title: 'Green Card Interview Questions About Your Home',
      metaTitle: 'Green Card Interview Questions About Your Home | USCIS Guide',
      metaDescription: 'Prepare for USCIS questions about your home and living situation. Learn what details officers ask about bedrooms, bathrooms, and household items.',
      h1: 'Green Card Interview Questions About Your Home',
      keywords: ['green card interview home questions', 'USCIS living situation questions', 'marriage interview bedroom questions'],
      parentCluster: 'living-together',
      relatedQuestions: ['What is your address?', 'What side of the bed do you sleep on?', 'What color are your bedroom walls?'],
      contentSections: [
        {
          id: 'home-basics',
          title: 'Basic Home Questions',
          content: 'Be ready to state your address, describe your residence type (apartment, house, condo), and explain who else lives there. Know details like how many bedrooms and bathrooms you have.'
        },
        {
          id: 'bedroom-details',
          title: 'Bedroom and Sleeping Arrangements',
          content: 'Officers often ask which side of the bed each person sleeps on, bedding colors, closet space allocation, and bedroom layout. These intimate details are difficult for fake couples to coordinate.'
        },
        {
          id: 'household-items',
          title: 'Household Items and Furniture',
          content: 'Be familiar with major furniture pieces, who owns what, and recent purchases. Officers may ask about your TV, appliances, or furniture to verify shared living space.'
        },
        {
          id: 'common-mistakes',
          title: 'Common Mistakes',
          content: 'Not knowing basic details about your home is a major red flag. Claiming to sleep in separate rooms without a good reason, or not knowing your own address, can seriously damage your case.',
          hasCommonMistakes: true
        }
      ]
    },
    {
      slug: 'green-card-interview-questions-about-daily-routines',
      title: 'Green Card Interview Questions About Daily Routines',
      metaTitle: 'Green Card Interview Questions About Daily Routines | USCIS',
      metaDescription: 'Prepare for USCIS questions about daily routines. Learn how to answer about morning schedules, meals, and household habits with your spouse.',
      h1: 'Green Card Interview Questions About Daily Routines',
      keywords: ['daily routine interview questions', 'USCIS routine questions', 'marriage interview schedules'],
      parentCluster: 'living-together',
      relatedQuestions: ['Who wakes up first?', 'What did you have for breakfast?', 'What time do you go to bed?'],
      contentSections: [
        {
          id: 'morning-routines',
          title: 'Morning Routine Questions',
          content: 'What time do you each wake up? Who makes breakfast? What do you typically eat? Who leaves for work first? These questions establish the rhythm of your shared daily life.'
        },
        {
          id: 'evening-routines',
          title: 'Evening and Bedtime Routines',
          content: 'What time do you get home? Who cooks dinner? What do you do in the evenings? What time do you go to bed? Couples who live together naturally know these patterns.'
        },
        {
          id: 'weekend-activities',
          title: 'Weekend and Leisure Time',
          content: 'What did you do last weekend? What do you typically do on Saturdays? How do you spend Sundays? Recent shared experiences demonstrate ongoing relationship activity.'
        },
        {
          id: 'example-answers',
          title: 'Example Routine Descriptions',
          content: 'Examples of natural routine descriptions for different lifestyles: working couples, couples with different schedules, couples where one works from home, and couples with children.',
          hasExampleAnswer: true
        }
      ]
    },
    {
      slug: 'uscis-interview-questions-about-household-chores',
      title: 'USCIS Interview Questions About Household Chores',
      metaTitle: 'USCIS Interview Questions About Household Chores | Green Card',
      metaDescription: 'Prepare for USCIS questions about household responsibilities. Learn how to answer about cooking, cleaning, and dividing household tasks.',
      h1: 'USCIS Interview Questions About Household Chores',
      keywords: ['household chores interview questions', 'USCIS cleaning cooking questions', 'marriage interview responsibilities'],
      parentCluster: 'living-together',
      relatedQuestions: ['Who cooks?', 'Who does the laundry?', 'How do you divide household tasks?'],
      contentSections: [
        {
          id: 'cooking-meals',
          title: 'Cooking and Meal Questions',
          content: 'Who typically cooks? What did you have for dinner last night? What foods does your spouse like or dislike? Kitchen knowledge reveals daily interaction patterns.'
        },
        {
          id: 'cleaning-tasks',
          title: 'Cleaning and Household Maintenance',
          content: 'Who does laundry? Who cleans the bathroom? How do you divide cleaning responsibilities? Officers may ask about specific household products or appliances.'
        },
        {
          id: 'bathroom-details',
          title: 'Bathroom and Personal Space Details',
          content: 'What brand of shampoo does your spouse use? What color are your towels? Bathroom details are intimate knowledge that genuine couples naturally acquire.'
        }
      ]
    }
  ]
};

// ============================================================================
// CLUSTER 4: FAMILY AND SOCIAL LIFE
// ============================================================================

const familySocialCluster: ContentCluster = {
  id: 'family-social',
  slug: 'family-social',
  name: 'Family and Social Life',
  shortName: 'Family',
  description: 'Questions about family members, in-laws, friends, and social activities as a couple',
  
  pillarPage: {
    slug: 'uscis-marriage-interview-questions-about-family-social-life',
    title: 'USCIS Marriage Interview Questions About Family and Social Life',
    metaTitle: 'USCIS Marriage Interview Questions About Family | Green Card',
    metaDescription: 'Prepare for USCIS marriage interview questions about family and social life. Learn how to answer questions about in-laws, friends, and social activities as a couple.',
    h1: 'USCIS Marriage Interview Questions About Family and Social Life',
    keywords: [
      'USCIS marriage interview questions',
      'family interview questions',
      'marriage green card interview questions',
      'in-law questions immigration'
    ],
    sections: [
      {
        id: 'why-ask',
        title: 'Why Officers Ask About Family and Friends',
        content: 'Marriage integrates two people into each other\'s social worlds. Officers ask about family members, in-laws, and friends to verify that your relationship extends beyond just the two of you into genuine social integration.'
      },
      {
        id: 'family-members',
        title: 'Questions About Family Members',
        content: 'Officers may ask about parents, siblings, and extended family on both sides. Have your spouse\'s parents met your parents? Do you know your spouse\'s siblings\' names and basic details?',
        linkToSupporting: ['marriage-interview-questions-about-in-laws']
      },
      {
        id: 'meeting-family',
        title: 'When Families Met',
        content: 'Questions about when and how your families first met are common. Officers want to see that your families are aware of and involved in your relationship, not kept separate.'
      },
      {
        id: 'friends-social',
        title: 'Friends and Social Activities',
        content: 'Who are your spouse\'s friends? What do you do together as a couple with friends? Social integration demonstrates that your relationship exists within a community context.',
        linkToSupporting: ['green-card-interview-questions-about-friends']
      },
      {
        id: 'holidays-traditions',
        title: 'Holidays and Family Traditions',
        content: 'How do you spend holidays? Which family do you visit? What traditions do you share? Holiday patterns reveal the depth of family integration in your marriage.'
      },
      {
        id: 'prepare',
        title: 'How to Prepare Together',
        content: 'Make sure you can name your spouse\'s immediate family members. Discuss when your families met and what you do together. Talk about your shared friends and recent social activities.'
      }
    ]
  },
  
  supportingPages: [
    {
      slug: 'marriage-interview-questions-about-in-laws',
      title: 'Marriage Interview Questions About In-Laws',
      metaTitle: 'Marriage Interview Questions About In-Laws | USCIS Guide',
      metaDescription: 'Prepare for USCIS questions about in-laws and family. Learn how to answer about your spouse\'s parents, siblings, and family relationships.',
      h1: 'Marriage Interview Questions About In-Laws',
      keywords: ['in-law interview questions', 'USCIS family questions', 'spouse parents immigration interview'],
      parentCluster: 'family-social',
      relatedQuestions: ["What are your mother-in-law's names?", 'Have you met your spouse\'s parents?', 'How many siblings does your spouse have?'],
      contentSections: [
        {
          id: 'basic-family-info',
          title: 'Basic Family Information',
          content: 'Be able to name your spouse\'s parents and siblings. Know where they live, what they do for work, and basic details about their lives. This shows genuine integration into your spouse\'s family.'
        },
        {
          id: 'meeting-in-laws',
          title: 'When You Met the In-Laws',
          content: 'When did you first meet your spouse\'s parents? Where did it happen? What did you talk about? First meetings with in-laws are significant relationship milestones.'
        },
        {
          id: 'relationship-with-in-laws',
          title: 'Your Relationship With In-Laws',
          content: 'How often do you see or talk to your in-laws? Do you get along with them? Have you spent holidays with them? Ongoing relationship with in-laws demonstrates family integration.'
        },
        {
          id: 'common-mistakes',
          title: 'Common Mistakes',
          content: 'Not knowing basic information about your spouse\'s family is a serious red flag. Claiming you\'ve never met or spoken to in-laws without a strong reason (extreme distance, estrangement) can hurt your case.',
          hasCommonMistakes: true
        }
      ]
    },
    {
      slug: 'green-card-interview-questions-about-friends',
      title: 'Green Card Interview Questions About Friends',
      metaTitle: 'Green Card Interview Questions About Friends | USCIS',
      metaDescription: 'Prepare for USCIS questions about friends and social life. Learn how to answer about shared friends and couple activities.',
      h1: 'Green Card Interview Questions About Friends',
      keywords: ['friends interview questions', 'USCIS social life questions', 'couple friends green card'],
      parentCluster: 'family-social',
      relatedQuestions: ['Who are your spouse\'s friends?', 'What do you do for fun together?', 'Who are your couple friends?'],
      contentSections: [
        {
          id: 'spouse-friends',
          title: 'Your Spouse\'s Friends',
          content: 'Be able to name a few of your spouse\'s close friends. Where do they live? What do they do? Have you met them? Knowing your spouse\'s social circle indicates genuine relationship depth.'
        },
        {
          id: 'shared-friends',
          title: 'Friends You Have in Common',
          content: 'Do you have mutual friends? Couples often develop shared friendships over time. Officers may ask about friends who attended your wedding or who you socialize with together.'
        },
        {
          id: 'social-activities',
          title: 'Social Activities as a Couple',
          content: 'What do you do for fun together? Do you have regular activities, hobbies, or groups you participate in? Active social lives demonstrate an ongoing genuine relationship.'
        },
        {
          id: 'recent-activities',
          title: 'Recent Social Activities',
          content: 'What did you do last weekend? When did you last see friends together? Recent shared social experiences are strong evidence of an ongoing genuine marriage.'
        }
      ]
    }
  ]
};

// ============================================================================
// CLUSTER 5: FINANCES AND SHARED RESPONSIBILITIES
// ============================================================================

const financesCluster: ContentCluster = {
  id: 'finances',
  slug: 'finances',
  name: 'Finances and Shared Responsibilities',
  shortName: 'Finances',
  description: 'Questions about shared finances, bank accounts, bills, insurance, and major purchases',
  
  pillarPage: {
    slug: 'uscis-marriage-interview-questions-about-finances',
    title: 'USCIS Marriage Interview Questions About Finances and Shared Responsibilities',
    metaTitle: 'USCIS Marriage Interview Questions About Finances | Green Card',
    metaDescription: 'Prepare for USCIS marriage interview questions about finances. Learn how to answer about shared bank accounts, bills, insurance, and financial responsibilities.',
    h1: 'USCIS Marriage Interview Questions About Finances and Shared Responsibilities',
    keywords: [
      'USCIS marriage interview questions',
      'finances interview questions',
      'marriage green card interview questions',
      'joint bank account immigration'
    ],
    sections: [
      {
        id: 'why-ask',
        title: 'Why Officers Ask About Finances',
        content: 'Financial interdependence is a hallmark of genuine marriage. Officers ask about shared bank accounts, bill payments, insurance, and major purchases to verify that your lives are economically intertwined, not just emotionally connected.'
      },
      {
        id: 'bank-accounts',
        title: 'Bank Accounts and Money Management',
        content: 'Do you have joint bank accounts? Who manages the finances? How do you divide expenses? Financial questions establish whether you operate as an economic unit.',
        linkToSupporting: ['marriage-interview-questions-about-shared-bank-accounts']
      },
      {
        id: 'bills-expenses',
        title: 'Bills and Household Expenses',
        content: 'Who pays the rent or mortgage? How are utilities handled? Who pays for groceries? How bills are divided reveals the practical logistics of your shared life.'
      },
      {
        id: 'insurance-benefits',
        title: 'Insurance and Benefits',
        content: 'Are you on each other\'s health insurance? Have you named each other as beneficiaries? These formal designations demonstrate legal and financial commitment.'
      },
      {
        id: 'major-purchases',
        title: 'Major Purchases and Assets',
        content: 'Have you made major purchases together? Do you own property, vehicles, or other assets jointly? Shared assets indicate long-term financial partnership.',
        linkToSupporting: ['uscis-interview-questions-about-joint-assets']
      },
      {
        id: 'prepare',
        title: 'How to Prepare Financial Answers',
        content: 'Review your accounts, bills, and insurance documents together. Make sure you both know who pays for what and that your stories align about major financial decisions.'
      }
    ]
  },
  
  supportingPages: [
    {
      slug: 'marriage-interview-questions-about-shared-bank-accounts',
      title: 'Marriage Interview Questions About Shared Bank Accounts',
      metaTitle: 'Marriage Interview Questions About Shared Bank Accounts | USCIS',
      metaDescription: 'Prepare for USCIS questions about joint bank accounts. Learn how to answer about shared finances and money management in your marriage.',
      h1: 'Marriage Interview Questions About Shared Bank Accounts',
      keywords: ['shared bank account interview questions', 'joint account USCIS', 'marriage interview finances'],
      parentCluster: 'finances',
      relatedQuestions: ['Do you have joint bank accounts?', 'Who manages the finances?', 'How do you divide expenses?'],
      contentSections: [
        {
          id: 'joint-vs-separate',
          title: 'Joint vs. Separate Accounts',
          content: 'Many couples have a mix of joint and separate accounts. Be prepared to explain your arrangement. There is no single "correct" structure—what matters is that you can explain your system clearly.'
        },
        {
          id: 'account-details',
          title: 'Bank Account Details to Know',
          content: 'Know which banks you use, account types (checking, savings), and approximate balances. Officers may ask when accounts were opened and how money is deposited or transferred.'
        },
        {
          id: 'no-joint-accounts',
          title: 'If You Do Not Have Joint Accounts',
          content: 'Some couples keep separate finances for various reasons. If this is your situation, be prepared to explain how you handle shared expenses like rent, utilities, and groceries without joint accounts.'
        },
        {
          id: 'common-mistakes',
          title: 'Common Mistakes',
          content: 'Not knowing anything about your spouse\'s finances is a red flag. Having completely separate finances with no explanation for how you manage shared expenses can raise questions.',
          hasCommonMistakes: true
        }
      ]
    },
    {
      slug: 'uscis-interview-questions-about-joint-assets',
      title: 'USCIS Interview Questions About Joint Assets',
      metaTitle: 'USCIS Interview Questions About Joint Assets | Green Card',
      metaDescription: 'Prepare for USCIS questions about joint assets and major purchases. Learn how to answer about property, vehicles, and shared investments.',
      h1: 'USCIS Interview Questions About Joint Assets',
      keywords: ['joint assets interview questions', 'USCIS property questions', 'marriage interview major purchases'],
      parentCluster: 'finances',
      relatedQuestions: ['Do you own any property together?', 'Have you made major purchases together?', 'Who owns your car?'],
      contentSections: [
        {
          id: 'property-ownership',
          title: 'Property and Real Estate',
          content: 'If you own a home or property together, know the address, purchase date, mortgage details, and how the title is held. Joint property is strong evidence of commitment.'
        },
        {
          id: 'vehicles',
          title: 'Vehicles and Transportation',
          content: 'Who owns your vehicles? Whose name is on the title and registration? Do you share cars? Vehicle ownership and usage patterns reveal practical aspects of shared life.'
        },
        {
          id: 'major-purchases',
          title: 'Major Purchases Together',
          content: 'Have you bought furniture, appliances, electronics, or other expensive items together? How were these purchases decided and paid for? Major joint purchases demonstrate financial partnership.'
        },
        {
          id: 'insurance-beneficiaries',
          title: 'Insurance and Beneficiary Designations',
          content: 'Have you named each other as beneficiaries on life insurance, retirement accounts, or other policies? These formal designations show long-term commitment and financial interdependence.'
        }
      ]
    }
  ]
};

// ============================================================================
// EXPORT ALL CLUSTERS
// ============================================================================

export const CONTENT_CLUSTERS: ContentCluster[] = [
  relationshipHistoryCluster,
  weddingCeremonyCluster,
  livingTogetherCluster,
  familySocialCluster,
  financesCluster,
];

// Helper functions for accessing cluster data

export function getClusterBySlug(slug: string): ContentCluster | undefined {
  return CONTENT_CLUSTERS.find(c => c.slug === slug);
}

export function getPillarPageConfig(clusterSlug: string): PillarPageConfig | undefined {
  const cluster = getClusterBySlug(clusterSlug);
  return cluster?.pillarPage;
}

export function getSupportingPageConfig(clusterSlug: string, pageSlug: string): SupportingPageConfig | undefined {
  const cluster = getClusterBySlug(clusterSlug);
  return cluster?.supportingPages.find(p => p.slug === pageSlug);
}

export function getAllSupportingPages(): SupportingPageConfig[] {
  return CONTENT_CLUSTERS.flatMap(c => c.supportingPages);
}

export function getAllPillarPages(): PillarPageConfig[] {
  return CONTENT_CLUSTERS.map(c => c.pillarPage);
}

// Navigation helper for internal linking
export function getClusterNavigation(clusterSlug: string): {
  pillar: PillarPageConfig;
  supporting: SupportingPageConfig[];
  relatedClusters: ContentCluster[];
} | null {
  const cluster = getClusterBySlug(clusterSlug);
  if (!cluster) return null;
  
  return {
    pillar: cluster.pillarPage,
    supporting: cluster.supportingPages,
    relatedClusters: CONTENT_CLUSTERS.filter(c => c.slug !== clusterSlug).slice(0, 2),
  };
}
