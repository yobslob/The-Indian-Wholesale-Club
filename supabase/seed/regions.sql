-- =============================================================================
-- The 36 regions: 28 states + 8 union territories, treated identically (D-002).
-- Names and slugs are factual. Greetings are DRAFTS written by Claude
-- (content_status = 'draft', D-019): hidden on the storefront until the founder
-- approves them in the admin. Where Claude was not confident, the greeting is
-- left NULL for the founder to fill in. Taglines, stories, images and accent
-- colours are intentionally empty (design + founder content, design.md).
-- =============================================================================

insert into public.regions
  (slug, name, sort_order, greeting_native, greeting_script, greeting_latin, greeting_meaning, languages)
values
  ('andaman-and-nicobar-islands', 'Andaman and Nicobar Islands', 1, null, null, null, null, '{}'),
  ('andhra-pradesh', 'Andhra Pradesh', 2, 'నమస్కారం', 'Telu', 'Namaskaram', 'A respectful greeting', '{Telugu}'),
  ('arunachal-pradesh', 'Arunachal Pradesh', 3, null, null, null, null, '{}'),
  ('assam', 'Assam', 4, 'নমস্কাৰ', 'Beng', 'Nomoskar', 'A respectful greeting', '{Assamese}'),
  ('bihar', 'Bihar', 5, 'प्रणाम', 'Deva', 'Pranam', 'A respectful greeting', '{Hindi}'),
  ('chandigarh', 'Chandigarh', 6, 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'Guru', 'Sat Sri Akal', 'The Punjabi greeting', '{Punjabi}'),
  ('chhattisgarh', 'Chhattisgarh', 7, 'जय जोहार', 'Deva', 'Jai Johar', 'The traditional Chhattisgarhi greeting', '{Chhattisgarhi}'),
  ('dadra-and-nagar-haveli-and-daman-and-diu', 'Dadra and Nagar Haveli and Daman and Diu', 8, 'કેમ છો', 'Gujr', 'Kem chho', 'How are you?', '{Gujarati}'),
  ('delhi', 'Delhi', 9, 'नमस्ते', 'Deva', 'Namaste', 'A respectful greeting', '{Hindi}'),
  ('goa', 'Goa', 10, null, null, null, null, '{}'),
  ('gujarat', 'Gujarat', 11, 'કેમ છો', 'Gujr', 'Kem chho', 'How are you?', '{Gujarati}'),
  ('haryana', 'Haryana', 12, 'राम राम', 'Deva', 'Ram Ram', 'The traditional Haryanvi greeting', '{Haryanvi}'),
  ('himachal-pradesh', 'Himachal Pradesh', 13, 'नमस्ते', 'Deva', 'Namaste', 'A respectful greeting', '{Hindi}'),
  ('jammu-and-kashmir', 'Jammu and Kashmir', 14, null, null, null, null, '{}'),
  ('jharkhand', 'Jharkhand', 15, 'जोहार', 'Deva', 'Johar', 'The traditional greeting of Jharkhand', '{}'),
  ('karnataka', 'Karnataka', 16, 'ನಮಸ್ಕಾರ', 'Knda', 'Namaskara', 'A respectful greeting', '{Kannada}'),
  ('kerala', 'Kerala', 17, 'നമസ്കാരം', 'Mlym', 'Namaskaram', 'A respectful greeting', '{Malayalam}'),
  ('ladakh', 'Ladakh', 18, null, null, 'Julley', 'Hello, thank you and goodbye in one word', '{Ladakhi}'),
  ('lakshadweep', 'Lakshadweep', 19, null, null, null, null, '{}'),
  ('madhya-pradesh', 'Madhya Pradesh', 20, 'नमस्ते', 'Deva', 'Namaste', 'A respectful greeting', '{Hindi}'),
  ('maharashtra', 'Maharashtra', 21, 'नमस्कार', 'Deva', 'Namaskar', 'A respectful greeting', '{Marathi}'),
  ('manipur', 'Manipur', 22, null, null, 'Khurumjari', 'A Meitei greeting', '{Meitei}'),
  ('meghalaya', 'Meghalaya', 23, 'Khublei', 'Latn', 'Khublei', 'Hello and thank you (Khasi)', '{Khasi}'),
  ('mizoram', 'Mizoram', 24, 'Chibai', 'Latn', 'Chibai', 'Hello (Mizo)', '{Mizo}'),
  ('nagaland', 'Nagaland', 25, null, null, null, null, '{}'),
  ('odisha', 'Odisha', 26, 'ନମସ୍କାର', 'Orya', 'Namaskara', 'A respectful greeting', '{Odia}'),
  ('puducherry', 'Puducherry', 27, 'வணக்கம்', 'Taml', 'Vanakkam', 'A respectful greeting', '{Tamil}'),
  ('punjab', 'Punjab', 28, 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', 'Guru', 'Sat Sri Akal', 'The Punjabi greeting', '{Punjabi}'),
  ('rajasthan', 'Rajasthan', 29, 'खम्मा घणी', 'Deva', 'Khamma Ghani', 'The traditional Rajasthani greeting', '{Rajasthani}'),
  ('sikkim', 'Sikkim', 30, 'नमस्ते', 'Deva', 'Namaste', 'A respectful greeting', '{Nepali}'),
  ('tamil-nadu', 'Tamil Nadu', 31, 'வணக்கம்', 'Taml', 'Vanakkam', 'A respectful greeting', '{Tamil}'),
  ('telangana', 'Telangana', 32, 'నమస్కారం', 'Telu', 'Namaskaram', 'A respectful greeting', '{Telugu}'),
  ('tripura', 'Tripura', 33, 'নমস্কার', 'Beng', 'Nomoshkar', 'A respectful greeting', '{Bengali}'),
  ('uttar-pradesh', 'Uttar Pradesh', 34, 'नमस्ते', 'Deva', 'Namaste', 'A respectful greeting', '{Hindi}'),
  ('uttarakhand', 'Uttarakhand', 35, 'नमस्ते', 'Deva', 'Namaste', 'A respectful greeting', '{Hindi}'),
  ('west-bengal', 'West Bengal', 36, 'নমস্কার', 'Beng', 'Nomoshkar', 'A respectful greeting', '{Bengali}');
