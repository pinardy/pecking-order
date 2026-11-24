import { RIVALS, rivalAt, type Run } from "./arcade";
import type { Rules } from "./game";

// Story mode: a climb up the barn told in scenes between the fights. Each scene is drawn with
// the arena of the coming fight and the two birds in it, and plays a line of dialogue at a time.
//
// Every fighter has an arc of their own: an opening with Old Spur calling down from the roof, a
// thought at the halfway mark, a scene with their rival (always the fourth fight), a showdown with
// Old Spur, and an epilogue. The opponents in between have their own way of meeting the player and
// of losing to them, and each arena has a line or two to set the scene.

export type Mood = "angry" | "hurt" | "happy";

export interface Line {
  /** Who says it: a fighter's id, or "" for the narrator. */
  who: string;
  text: string;
  /** Who stands on the right during this line, where it is not the scene's usual opponent. */
  with?: string;
  /** How the speaker looks while saying it. A loser slumps; a winner is pleased. */
  mood?: Mood;
  /** A choice for the player, in place of a line: how to answer the rival. */
  choice?: { fired: string; calm: string };
}

/** How the player chose to answer their rival: fired up (a full meter, the twist stands) or calm (a fair fight, no twist). */
export type Choice = "fired" | "calm";

export interface Scene {
  /** The two birds on stage: the player's fighter on the left, whoever they are facing on the right. */
  left: string;
  right: string;
  stage: number;
  lines: Line[];
}

/** A line before it is cast: "me" is the player's fighter, "them" the other bird in the scene, "spur" Old Spur, "" the narrator. */
type Draft = ["me" | "them" | "spur" | "", string];

interface Arc {
  /** After the narrator has set the scene: the hero's reasons, with Old Spur calling down from the roof. */
  opening: Draft[];
  /** Two thoughts at the halfway mark, after the bonus round. */
  halfway: [string, string];
  /** The scene with their rival, before the fourth fight. */
  rival: Draft[];
  /** The showdown with Old Spur, before the last fight ("them" is Old Spur). */
  showdown: Draft[];
  /** The narrator's epilogue, and the hero's last word. */
  epilogue: string[];
  last: string;
  /** As an opponent: two lines on meeting the player, and a comeback after the player answers. */
  meet: [string, string];
  comeback: string;
  /** As an opponent, after losing: to anyone, and to their rival. */
  beaten: [string, string];
  beatenAsRival: [string, string];
  /** As the hero: answers to an opponent's opening, and words after a win, taken in turn. */
  retorts: [string, string, string];
  victory: [string, string, string];
}

const ARCS: Record<string, Arc> = {
  henrietta: {
    opening: [
      ["me", "Somebody has to rule this roost properly. It may as well be someone who can count her chickens."],
      ["me", "The roost rota hasn’t been touched in four years. The feed is a free-for-all. Pip has been sleeping in the water trough."],
      ["spur", "I can hear you clucking from up here, Henrietta. The yard runs itself."],
      ["me", "The yard runs round like a headless— well. You know. I’m coming up."],
    ],
    halfway: ["Three down. I never count my chickens, but I do count my wins.", "Item four on today’s list: the roof. Item five: give it a good henspring clean."],
    rival: [
      ["them", "Henrietta. Heard you were climbing. Assumed you’d hatched a list about it."],
      ["me", "Two lists, Dot. You’re on both. Egg-sactly where you belong."],
      ["them", "What’s my crime this time?"],
      ["me", "Dust baths in laying hours. Dust in the nest boxes. Fowl play, generally."],
      ["them", "It’s a dust bath. Dust is the main feature."],
      ["me", "Then feature it elsewhere. You’re walking on eggshells, Dot."],
      ["them", "I’m lying on them, actually. Very comfortable."],
      ["me", "Then I shall go round. Thoroughly. With a clipboard."],
    ],
    showdown: [
      ["them", "The hen with the lists. I wondered when you’d come home to roost."],
      ["me", "You haven’t signed the roost rota in four years."],
      ["them", "Four years? Time flies, for a bird that doesn’t."],
      ["me", "Nobody knows where they’re sleeping. It is a total scramble down there."],
      ["them", "It’s a farmyard. Scrambling is half the fun."],
      ["me", "Not on my watch. Stand aside, please. I did say please. I won’t say it twice. I’m not a parrot."],
    ],
    epilogue: [
      "Henrietta took the top of the barn and, within the hour, had it running like a well-oiled egg timer.",
      "The roost rota is pinned to the barn door. Feed is served at eight, twelve and four. Pip has been relocated from the water trough.",
      "Dot is on the rota. Mornings. She calls it hen-carceration.",
    ],
    last: "Right. Who’s next on the list? Egg-cellent.",
    meet: ["You’re in my henhouse.", "Wipe your feet. Then hatch an exit."],
    comeback: "Not until you’ve explained yourself. In writing.",
    beaten: ["Fine. Go on up.", "Mind the eggs on your way. I’ve counted them, and I will know."],
    beatenAsRival: ["I shall be amending the list.", "Under protest. In red. Underlined twice."],
    retorts: ["I’ll be quick. You’ve got eggs to sit on.", "Order is coming home to roost, and you’re in the way of it.", "I’ll add you to the list. Under ‘done’."],
    victory: ["Noted. Filed. Pecked.", "One more crossed off. Egg-cellent.", "Tidy. Very tidy. Next!"],
  },
  rusty: {
    opening: [
      ["me", "Six years I’ve crowed the sun up. Never missed a morning. Never even overslept a feather."],
      ["me", "It’s the same sun from down here. But the roof gets it first, and I’m sick of second-hand dawns."],
      ["spur", "The sun doesn’t need you, boy. It rises on its own. Like bread."],
      ["me", "Then it won’t mind who’s watching from the top. Rise and shine, old timer. Mostly rise."],
    ],
    halfway: ["Still light out. Good. I’ve a strict roost-er to keep.", "Back on that roof by dawn. Cock-a-doodle-do or die."],
    rival: [
      ["them", "Rusty! My rooster! Did you catch my dawn set this morning?"],
      ["me", "The whole county caught it, Ziggy. At four. That’s not dawn, that’s fowl play."],
      ["them", "Art doesn’t keep hours, man. Art keeps crowing."],
      ["me", "The sun keeps hours. So do I. Dawn is at six."],
      ["them", "Six is for spring chickens. The real fans are up at four."],
      ["me", "The real fans are asleep. And cranky. And they know where you roost."],
      ["them", "Battle of the bands, then. Winner gets sunrise. Loser gets henpecked."],
      ["me", "Winner gets sunrise. Let’s crow."],
    ],
    showdown: [
      ["them", "The early riser. I used to crow the sun up myself, you know."],
      ["me", "I know. You stopped. Now it just sort of wings it."],
      ["them", "The sun didn’t seem to mind."],
      ["me", "I minded. Every morning there’s been nobody on this roof. It’s been a real dawn-er."],
      ["them", "And you think it should be you."],
      ["me", "I think it should be someone who’s actually up. Time to rooster-ate the top job."],
    ],
    epilogue: [
      "Next morning the sun came up over the barn at six exactly, to a crow from the very top.",
      "Ziggy slept through it. That was the arrangement. They call it the peck-ace treaty.",
      "Old Spur, for the first time in years, had a lie-in. He described it as egg-straordinary.",
    ],
    last: "Right on time. Cock-a-doodle-done.",
    meet: ["Early bird gets the worm.", "Late bird gets the floor."],
    comeback: "Come on, then. I’m on a clock. A cuckoo clock, but still.",
    beaten: ["Huh. Sun’s still up.", "Fair enough. That’s a feather in your cap."],
    beatenAsRival: ["Fine. You take sunrise.", "But keep it down before six. Some of us need our beak-uty sleep."],
    retorts: ["Up and at ’em. Mostly at ’em.", "Let’s get this done before breakfast. I’m thinking eggs. Not yours.", "I’ve been up since five. You’re running fowl of schedule."],
    victory: ["Right. Next. Chop chop. Not literally.", "That’s on schedule. Peck-tual, even.", "Morning’s not over yet. Neither am I."],
  },
  pip: {
    opening: [
      ["me", "Everyone keeps stepping over me. Like I’m a puddle. A fluffy puddle."],
      ["me", "I’m two days old. That’s two whole days of being treated like chicken feed."],
      ["spur", "Is that a chick? Go back to your mother, little nugget."],
      ["me", "She sent me! She said I was getting under her feet! And I am NOT a nugget!"],
    ],
    halfway: ["Halfway! And I haven’t even had my nap. Cheep thrills, this.", "I might have a nap. After. Definitely after. Maybe a little bit during."],
    rival: [
      ["them", "Something is cheeping. I cannot see what."],
      ["me", "Down here, you great feathered wardrobe!"],
      ["them", "Ah. A crumb."],
      ["me", "A crumb that’s about to trip you up! Crumbs away!"],
      ["them", "Little one, I have stepped on bigger things than you by accident."],
      ["me", "Well, I’ve never been stepped on. Because I’m FAST. Poultry in motion, me."],
      ["them", "Very well. Try not to get underfoot."],
      ["me", "Underfoot is my whole thing!"],
    ],
    showdown: [
      ["them", "They are sending chicks now. How old are you?"],
      ["me", "Two days! Nearly three! I’m practically a hen-ager!"],
      ["them", "I have feathers older than you."],
      ["me", "That’s why you’re slow. You’re a hard-boiled old egg."],
      ["them", "... That is fair."],
      ["me", "Look down, grandad. Here comes the little guy."],
    ],
    epilogue: [
      "Pip is still the smallest bird in the yard.",
      "But from the top of the barn, everybody else looks small too. Pip calls it a chick-uation reversal.",
      "Duke has started watching where he puts his feet. Just in case.",
    ],
    last: "Told you. FAST. Poultry in motion!",
    meet: ["Down here!", "No, lower! LOWER! Mind the fluff!"],
    comeback: "Now you see me. Now you’re seeing stars.",
    beaten: ["That was a warm-up!", "I’m two days old! I’ll be back! After a nap!"],
    beatenAsRival: ["Fine! But I made you look down.", "That counts. It COUNTS. I’m telling Mum."],
    retorts: ["Small is fast. Fast is trouble. I’m both!", "I’ll be through your legs before you can say ‘who cheeped that?’", "Bigger they are, harder they fowl!"],
    victory: ["Yes! YES! Cheep cheep hooray!", "Did you see that? Did ANYONE see that?", "Next! Bring me the next one! I’m on a roll! An egg roll!"],
  },
  dot: {
    opening: [
      ["me", "I wasn’t going to bother with any of this. I’m more of a stay-in-the-nest sort of hen."],
      ["me", "Then somebody kicked dust in my bath. Not the nice dust. The gritty kind. Fowl."],
      ["spur", "Dust is dust, speckled one."],
      ["me", "Spoken like a bird who’s never had a proper bath. I’m coming up to complain. Beak to beak."],
    ],
    halfway: ["This is a lot of rungs for one dust bath. I’m egg-hausted.", "Still. It’s the principle. Apparently I have principles. Who knew. Not me."],
    rival: [
      ["them", "Dot. You are not on the list for the ladder."],
      ["me", "I’m not on any of your lists, Henrietta. That’s my whole free-range lifestyle."],
      ["them", "You are on six of them."],
      ["me", "Then you’ve been busy. I’ve been in my bath."],
      ["them", "Exactly. That’s item one on four of them. Fowl conduct."],
      ["me", "Move, Henrietta. There’s grit in my feathers and I am in a fowl mood."],
      ["them", "There are rules."],
      ["me", "There’s dust. Move. Before I ruffle more than feathers."],
    ],
    showdown: [
      ["them", "The speckled one. They tell me you can’t be bothered."],
      ["me", "I can’t. As a rule. My energy is a nest egg and I’m not spending it."],
      ["them", "And yet here you are."],
      ["me", "Somebody kicked gritty dust in my bath. In your yard. On your watch."],
      ["them", "It’s a farmyard. Dust gets kicked."],
      ["me", "Not my dust. Not any more. Consider yourself henpecked."],
    ],
    epilogue: [
      "Dot’s first and only act at the top of the pecking order was to declare her dust bath a no-fly zone.",
      "Then she climbed back down and got into it. Mission egg-complished.",
      "Henrietta has added a note about it to the rota. Dot hasn’t read it. Dot isn’t going to.",
    ],
    last: "Ahh. That’s the stuff. Dust to dust.",
    meet: ["I was in the middle of something.", "Can this wait? It can’t, can it. Cluck."],
    comeback: "Fine. Let’s get this over with. Peck-peck.",
    beaten: ["Lovely.", "May I get back to my bath now? I’m feeling a bit shell-shocked."],
    beatenAsRival: ["Fine. Put me down for mornings.", "Not early ones. I’m not a rooster."],
    retorts: ["I’ll keep this brief. Brief as a chick’s attention span.", "So was I. Let’s not drag our feathers.", "I’d rather be bathing. Let’s just wing it."],
    victory: ["There. Dusted.", "Right. Where was I? Oh yes. Bored.", "Don’t get up on my account. Do stay down, though."],
  },
  shelly: {
    opening: [
      ["me", "Everyone says wait until you’re ready. Finish hatching first. Don’t crack under pressure."],
      ["me", "I’m ready from the waist up. The rest of me is still working from home."],
      ["spur", "Half an egg, climbing my barn. Now I have seen everything."],
      ["me", "You haven’t seen me hatch the rest of the way. That’s happening at the top. It’ll be egg-pic."],
    ],
    halfway: ["Bit draughty up here. Good thing I kept the shell. It’s my shell-ter.", "Halfway up, halfway out. It’s a theme. I’m very on-brand."],
    rival: [
      ["them", "Oh, sweet pea, you’re not even hatched. Come here, let me keep you warm."],
      ["me", "I’m warm! I’m fine! Do NOT sit on me!"],
      ["them", "Just until you’re done, pet. You look a bit under-cooked."],
      ["me", "You sat on Pip for an hour last week!"],
      ["them", "And he came out lovely. Fluffy as a soufflé."],
      ["me", "He was already hatched, Goldie! He’d been hatched for DAYS!"],
      ["them", "Better safe than scrambled, sweet pea."],
      ["me", "I’ve laid mines, Goldie. Mind you don’t end up sunny side up."],
    ],
    showdown: [
      ["them", "Half an egg. Now I have seen everything."],
      ["me", "You keep saying that. You’re like a broken egg timer."],
      ["them", "It keeps being true."],
      ["me", "I’m here to finish hatching. Up here. In front of everyone. It’s my big crack."],
      ["them", "Why up here?"],
      ["me", "Because it’s the top. Nobody hatches halfway at the top. Have some shell-f respect."],
    ],
    epilogue: [
      "At the top of the barn, with the whole yard watching, Shelly finally hatched the rest of the way.",
      "It took four minutes. Goldie cried. Pip called it egg-straordinary, then had a nap.",
      "She kept the shell. It is a trophy now, and on wet days a hat. Shell chic.",
    ],
    last: "Ta-da! Fully hatched and egg-cellent!",
    meet: ["Watch your step.", "I’ve been laying mines. It’s made me a bit of a shell-ebrity."],
    comeback: "Go on. Step closer. Walk on eggshells.",
    beaten: ["Okay. Okay! I cracked.", "Next time I’m hatching first."],
    beatenAsRival: ["That was... actually quite warm.", "Don’t tell anyone. I have a shell-f image to keep."],
    retorts: ["Half hatched, fully ready. Shell yeah.", "You’ll have to crack me first. Good yolk.", "The shell’s on. The gloves are off. Well. I don’t have gloves. Or arms."],
    victory: ["Boom! Egg-splosive!", "Mind the shell on your way down.", "Shell-ebrate! No? No. Fair."],
  },
  duke: {
    opening: [
      ["me", "There is a crown on top of that barn."],
      ["me", "It is a size too small for the bird wearing it. I intend to do it a fowl-vour."],
      ["spur", "Duke. You have waited a long time, big fella. Your patience is egg-semplary."],
      ["me", "I have been patient. I have run out of patience. I have run out of chicken feed for it. I am coming up."],
    ],
    halfway: ["Halfway. The ladder creaks.", "That is the ladder’s problem. I am built like a brick henhouse."],
    rival: [
      ["them", "Oi! Big bird! Down here!"],
      ["me", "Something is cheeping. Faintly."],
      ["them", "It’s me! Pip! I’m in your way! On purpose!"],
      ["me", "I see. Or rather, I don’t. You are the size of a nugget."],
      ["them", "I’m going to trip you up, and everyone’s going to see it, and you’ll have egg on your face!"],
      ["me", "Then I shall be careful where I step."],
      ["them", "You’re never careful where you step! You flattened a henhouse!"],
      ["me", "One henhouse. It was mostly empty. Slightly careful, then."],
    ],
    showdown: [
      ["them", "Duke. I wondered when you would stop waiting."],
      ["me", "So did I. I have been brooding on it."],
      ["them", "You could have come up years ago."],
      ["me", "You might have come down. I gather you had got a bit cooped up."],
      ["them", "And given you the satisfaction?"],
      ["me", "The crown, old one. It never fitted you. Time this roost was ruled properly."],
    ],
    epilogue: [
      "Duke took his place at the top of the pecking order.",
      "He insists it is where he had always been. Nobody argues. Nobody fancies being henpecked by a heavyweight.",
      "Pip argues a little. Duke now watches where he puts his feet. Mostly.",
    ],
    last: "Back of the queue, everyone. The pecking order is restored.",
    meet: ["You have come a long way.", "To be sent back down. Like a bad egg."],
    comeback: "Hm. Bold. Plucky, even.",
    beaten: ["I’ll allow it.", "Once. Do not count your chickens."],
    beatenAsRival: ["I did not see that coming.", "I did not see any of it. It was very small."],
    retorts: ["Back of the queue, you said? Funny. I don’t queue.", "Stand aside, or be moved aside. Like a hen in front of a tractor.", "I have stepped on bigger. Most of them were eggs."],
    victory: ["As expected. Hard-boiled.", "The pecking order has been explained to you.", "Next. Chop chop."],
  },
  goldie: {
    opening: [
      ["me", "I hear the view from the top of the barn is lovely."],
      ["me", "I’d like a sit-down up there. Nothing fancy. A long one. A proper brood."],
      ["spur", "You have never hurried in your life, Goldie. You’re about as quick as a frozen chicken."],
      ["me", "I’m not hurrying now, sweet pea. Slow and steady wins the race. Ask the tortoise. Then sit on him."],
    ],
    halfway: ["Halfway. I might have a little rest. A nest break.", "No? Onwards, then. Gently. Like a hen on a hot tin roof."],
    rival: [
      ["them", "Stay back! I know what you’re going to do!"],
      ["me", "I only want to keep you warm, pet. You’re half out. You’ll catch a chill in your yolk."],
      ["them", "It’s a LOOK! It’s on purpose!"],
      ["me", "Of course it is. And it’s a lovely look. Very egg-sperimental."],
      ["them", "You sat on Pip for an hour!"],
      ["me", "He was chilly. He said thank you, after."],
      ["them", "He said HELP!"],
      ["me", "Same thing, at that age. Come here. Mother hen knows best."],
    ],
    showdown: [
      ["them", "Goldie. You climbed all this way? You never hurry."],
      ["me", "I didn’t hurry. I just didn’t stop. Like a very determined casserole."],
      ["them", "And what do you want with my roof?"],
      ["me", "A sit-down. The view. A nest with a view, really."],
      ["them", "That’s all?"],
      ["me", "That’s all, sweet pea. Budge up. Mother hen is coming in to land."],
    ],
    epilogue: [
      "Goldie sat down at the top of the barn and declared the view every bit as lovely as promised.",
      "She is still there. Nobody has the heart to move her, and nobody has the forklift.",
      "There is room for one more, if you ask nicely and don’t mind being brooded over.",
    ],
    last: "Lovely. Absolutely egg-squisite.",
    meet: ["Come here, sweet pea.", "Let me give you a hug. A big one. A smother-hen special."],
    comeback: "Oh, you’re feisty. I like feisty. Plucky little thing.",
    beaten: ["Well, aren’t you a tough little nugget.", "Off you go, then. Wrap up warm."],
    beatenAsRival: ["Well. You hatched fighting.", "I’ll give you that, pet. Tough as an old boot. A small boot."],
    retorts: ["I’ve been told I give the best hugs. Mostly by birds who couldn’t breathe.", "Let’s not rush. Good things come to those who brood.", "Sit still, pet. This won’t hurt much. Mother hen promises."],
    victory: ["There we are. All tucked in.", "All better. Have a little lie-down.", "Up you get, sweet pea. Gently does it."],
  },
  ziggy: {
    opening: [
      ["me", "Ladies, gentlemen, hens of all ages: are you ready to rock and roost?"],
      ["me", "The top of that barn has the best acoustics in the county. One crow up there carries three farms."],
      ["spur", "I have heard you from up here, Ziggy. Everyone has. The cows have filed a complaint."],
      ["me", "Then you know what’s coming. Tonight’s show: The Climb. One night only. Bring earplugs and egg-spectations."],
    ],
    halfway: ["Halfway up and the crowd’s warming to me. I can feel it in my comb.", "Best gig since Henhouse Unplugged last spring. And that went platinum. Well. Pewter."],
    rival: [
      ["them", "Ziggy. It’s four in the morning when you start. Four."],
      ["me", "Dawn’s a feeling, man. Not a time. It’s a vibe. A cluck-vibe."],
      ["them", "It’s a time. Six. I keep it."],
      ["me", "You keep it. I rock it."],
      ["them", "You rock it at four. The goats are talking about forming a union."],
      ["me", "Early show sells out, Rusty. Hottest ticket in the coop."],
      ["them", "Everyone’s asleep, Ziggy. That’s why nobody’s complained to your face."],
      ["me", "Battle of the bands, then. Winner gets sunrise. Loser opens for the winner."],
    ],
    showdown: [
      ["them", "The loud one. I have heard you from up here. Everyone has."],
      ["me", "Is that a compliment?"],
      ["them", "It is a noise complaint. From three farms and a lighthouse."],
      ["me", "Ha! I’ll frame it. Next to my gold record. It’s a yolk."],
      ["them", "And what will you do with my roof?"],
      ["me", "Headline it. This next one’s called Move Over, Old Rooster. It’s a real hen-thusiast favourite."],
    ],
    epilogue: [
      "Ziggy played the barn roof until sunrise, then an encore, then another encore.",
      "Three farms heard every note. Two have written in. One asked for an autograph, then for a little less volume.",
      "Rusty has bought earplugs. He wears them until six, and calls it the peace of the roost.",
    ],
    last: "Thank you! Goodnight! You’ve been egg-cellent!",
    meet: ["Ladies and gentlemen,", "the opening act! Give it up for the chicken feed!"],
    comeback: "Big entrance. Let’s see the big finish. Hope you’re not a one-hen band.",
    beaten: ["Crowd loved it, though.", "The crowd loved it. Encore? No? Cluck."],
    beatenAsRival: ["Okay, okay. You take sunrise.", "I’ll take the late show. Night owls only. No offence to owls."],
    retorts: ["I’m the headliner here. You’re the warm-up. Warm-ish.", "Turn it down, chick. I’m up next.", "Is this the support act? Cute. Very cheep."],
    victory: ["Thank you! Thank you! I’ll be here all week!", "And that’s the encore. Mic drop. Wing drop.", "Somebody get that bird a stool. And some ice."],
  },
  pepper: {
    opening: [
      ["me", "I hatched in the chilli patch. Nobody sat on me. The sun did it. Explains a lot, apparently."],
      ["me", "So I’m not at the bottom of the pecking order. I’m not on it at all. Henrietta checked. Twice."],
      ["spur", "A chick nobody has counted. Go home, little spark, before you burn yourself out."],
      ["me", "I am home. That’s the problem. Put the kettle on, old timer. Things are about to get heated."],
    ],
    halfway: ["Halfway. Is it warm up here, or is it me? It’s me. It’s always me.", "They keep saying I’ll simmer down. I’ve never simmered in my life. I go straight to the boil."],
    // Her rival is Henrietta, who keeps the list she is not on. (Henrietta’s own is still Dot.)
    rival: [
      ["them", "Stop there, please. Name?"],
      ["me", "Pepper. You know it’s Pepper."],
      ["them", "You are not on the list. I have checked the hens, the chicks and the miscellaneous."],
      ["me", "I hatched in the chilli patch. Nobody wrote it down."],
      ["them", "Then officially you have not hatched. I can offer you a form."],
      ["me", "I’m standing right here! I’m two weeks old! I’m fully seasoned!"],
      ["them", "Unregistered poultry may not use the ladder. It is in the rules. I wrote them."],
      ["me", "Then write this down. Pepper. P, E, double P, and you’d better duck."],
    ],
    showdown: [
      ["them", "The uncounted chick. I am told you are not on the list."],
      ["me", "I’m not on anything. Not the list, not the rota, not the bottom rung."],
      ["them", "Then where, precisely, do you think you stand?"],
      ["me", "Nowhere. So I get to pick. I pick here."],
      ["them", "This spot is taken, little spark."],
      ["me", "I’m not a spark. I’m the whole chilli. Budge up, before it gets too hot in this henhouse."],
    ],
    epilogue: [
      "Pepper took the top of the barn, and the pecking order had her name on it at last. At the top. In red.",
      "Henrietta has entered her in the list. There was no column for her, so she was given a new one. It is headed ‘Handle with care’.",
      "Nobody has called her mild since. One of the goats tried. He is expected to recover.",
    ],
    last: "Top of the list. I told you it was getting hot in here.",
    meet: ["Go on. Say it.", "Say I look mild. I dare you. I double-dare you."],
    comeback: "Ooh, that’s done it. Now I’m steaming.",
    beaten: ["Ow. Okay. That one stung.", "I’m not cooling off. I’m resting my heat."],
    beatenAsRival: ["Fine. You win. This once.", "I’m still not mild. Write that down."],
    retorts: ["I’m small, I’m red and I’m out of patience. Pick two to worry about.", "Careful. I peck first, and it burns for an hour after.", "Talk all you like. I’ve a short fuse and a shorter walk to you."],
    victory: ["Too hot for you? Thought so.", "And that was me being mild.", "Next! While I’m still warmed up!"],
  },
  oldspur: {
    opening: [
      ["me", "They have stopped coming up to challenge me."],
      ["me", "Nobody has climbed this barn in three summers. A crown nobody tries to take is just a hat. And not even a nice hat."],
      ["me", "Very well. If the young ones will not come up to roost, I shall go down and ruffle some feathers."],
    ],
    halfway: ["My knees remember these rungs. They do not thank me for it.", "I am no spring chicken. But I am, at least, an autumn rooster."],
    // His rival is Duke, who waits at the foot of the ladder as his last fight.
    rival: [
      ["them", "You came down. I was beginning to think I would have to come up."],
      ["me", "You were welcome to. For years. The ladder was hardly cooped off."],
      ["them", "I was waiting to be asked."],
      ["me", "Nobody asks, Duke. That is the whole point of a pecking order."],
      ["them", "Then I am not asking now."],
      ["me", "Good. Let us see what all that brooding was for."],
    ],
    showdown: [],
    epilogue: [
      "Old Spur climbed back to the top of the barn, rather more slowly than he had come down.",
      "He kept his crown, and with it his egg-sperience.",
      "But the yard had seen him fight, and next morning three young birds were already eyeing the ladder. Spring chickens, the lot of them.",
    ],
    last: "Good. About time. The old rooster still has some cluck in him.",
    meet: ["Come back when your comb has grown in.", "I was winning these before your egg was laid."],
    comeback: "We shall see, chick.",
    beaten: ["Well.", "About time somebody did that."],
    beatenAsRival: ["Well.", "About time somebody did that."],
    retorts: ["Mind your manners. You are talking to the top of the pecking order.", "I have done this longer than you have been an egg.", "Again? Very well. Let us scramble."],
    victory: ["Hm. Not bad, for a youngster.", "Next. My knees and I are waiting.", "That is how we did it in my day. Hard-boiled."],
  },
};

/** The calm answer to each rival: a fair fight, with no twist. (The fired-up answer is the rival scene's own last line.) */
const CALM: Record<string, string> = {
  henrietta: "Let’s keep this civil, Dot. A fair fight. Then I’ll file the paperwork.",
  rusty: "Alright, Ziggy. No sunrise set. A straight fight, like grown roosters.",
  pip: "Okay, okay. Fair and square, big bird. Room to move and everything.",
  dot: "Fine. No rules, no lists. A normal fight, and then my bath.",
  shelly: "Alright, Goldie. We’ll just fight normally. No warming up, no smothering.",
  duke: "Very well, little one. Plenty of room. A fair fight. You will still lose.",
  goldie: "Let’s keep it gentle, pet. A nice ordinary scrap, then a cuddle.",
  ziggy: "Fine, Rusty. No gimmicks. Unplugged. Just you and me.",
  pepper: "Fine. Give me the form. I’ll fill it in after. A fair fight, clipboard down.",
};

/** Two scene-setting lines for each arena, for the narrator before an ordinary fight. */
const SETTINGS: [string, string][] = [
  ["The barnyard. Half the yard has stopped pecking to watch. It is quite the hen party.", "Straw, sunshine, and a crowd on the hay bales. Somebody is selling corn by the cob."],
  ["The cornfield at dusk. The corn whispers. It is all very ear-ie.", "Evening in the corn. Somewhere a cricket is taking bets, and the odds are poultry."],
  ["The henhouse after dark. Every hen on every perch has one eye open. Nobody wants to miss the egg-citement.", "Lantern light in the henhouse. Nobody is asleep, whatever they say. Nobody is chickening out of this."],
  ["The coop roof at dawn. Shingles, wind, and nowhere to back away to. No chickening out now.", "Up on the coop roof. The weathervane is pointing at you. Probably a coincidence. Probably."],
];

const BOSS = "oldspur";

const arc = (id: string): Arc => ARCS[id] ?? ARCS.henrietta;
const isFinal = (run: Run) => run.rung === run.ladder.length - 1;
const cast = (drafts: Draft[], me: string, them: string, with_?: string): Line[] =>
  drafts.map(([who, text]) => ({ who: who === "me" ? me : who === "them" ? them : who === "spur" ? BOSS : "", text, ...(with_ ? { with: with_ } : {}) }));
const narrate = (text: string, extra: Partial<Line> = {}): Line => ({ who: "", text, ...extra });

/** The scene before the fight at the run's current rung: meeting whoever is next. */
function meeting(run: Run, stage: number, earlier: Line[]): Scene {
  const me = run.p1;
  const them = run.ladder[run.rung];
  const lines = [...earlier];
  if (isFinal(run) && them === BOSS) {
    lines.push(
      narrate("The top of the barn. The very top of the pecking order. The wind up here smells of old feathers and older victories."),
      { who: BOSS, text: "So. You made it. Plucky." },
      ...cast(arc(me).showdown, me, BOSS),
      { who: BOSS, text: "Everybody climbs. Nobody stays. Let us see if you are all cluck and no peck." },
    );
  } else if (isFinal(run)) {
    // Old Spur's own run ends at the bottom of the ladder, with the bird who has been waiting there.
    lines.push(narrate("The foot of the ladder, at last. One bird has been waiting here a long time."), ...cast(arc(me).rival, me, them));
  } else if (rivalAt(run)) {
    const scene = cast(arc(me).rival, me, them);
    // In story mode the hero's last word to their rival is the player's to choose.
    const last = scene[scene.length - 1];
    if (run.story && CALM[me] && last.who === me) scene[scene.length - 1] = { ...last, choice: { fired: last.text, calm: CALM[me] } };
    lines.push(narrate("One rung from the top. And of course it is this one in the way."), ...scene);
  } else {
    const a = arc(them);
    lines.push(
      narrate(SETTINGS[stage % SETTINGS.length][run.rung % 2]),
      { who: them, text: a.meet[0] },
      { who: them, text: a.meet[1] },
      { who: me, text: arc(me).retorts[run.rung % 3] },
      { who: them, text: a.comeback },
    );
  }
  return { left: me, right: them, stage, lines };
}

/** The scene for the opening of a run: the yard, Old Spur on his roof, and why the hero is climbing. */
export function opening(run: Run, stage: number): Scene {
  const me = run.p1;
  const intro: Line[] =
    me === BOSS
      ? [
          narrate("Every yard has a pecking order.", { with: BOSS }),
          narrate("Old Spur has stood at the top of this one for as long as anyone remembers. Lately, he has been feeling rather cooped up.", { with: BOSS }),
          ...cast(arc(me).opening, me, BOSS, BOSS).map((l) => ({ ...l, with: "duke" })),
          narrate("Five fights stand between Old Spur and the foot of the ladder. Going down, for once."),
        ]
      : [
          narrate("Every yard has a pecking order.", { with: BOSS }),
          narrate("At the top of this one, for as long as anyone remembers, has stood Old Spur.", { with: BOSS }),
          narrate("Nobody has dared ruffle his feathers in three summers. Until this morning.", { with: BOSS }),
          ...cast(arc(me).opening, me, BOSS, BOSS),
          narrate(`Five fights stand between ${name(me)} and the barn roof. No chickening out.`, { with: BOSS }),
        ];
  return meeting(run, stage, intro);
}

/** Picking a story back up: just the meeting with whoever is next. */
export const resumed = (run: Run, stage: number): Scene => meeting(run, stage, []);

/** A beaten opponent's last words (different if they were the hero's rival), and the hero's answer. */
function aftermath(run: Run, beaten: string): Line[] {
  const words = RIVALS[run.p1] === beaten ? arc(beaten).beatenAsRival : arc(beaten).beaten;
  return [
    ...words.map((text): Line => ({ who: beaten, text, with: beaten, mood: "hurt" })),
    { who: run.p1, text: arc(run.p1).victory[(run.rung - 1 + 3) % 3], with: beaten, mood: "happy" },
  ];
}

/**
 * After a fight is won and the run has moved on: the beaten opponent has their last words and the
 * hero answers; then either the bonus round is set up or the next opponent steps in.
 */
export function between(run: Run, stage: number, beaten: string): Scene {
  const after = aftermath(run, beaten);
  if (run.bonus) {
    return {
      left: run.p1,
      right: beaten,
      stage,
      lines: [...after, narrate("Halfway up, the farmer has put out a scarecrow.", { with: beaten }), narrate("Nobody knows why. It is asking for it. Time to make hay.", { with: beaten })],
    };
  }
  const scene = meeting(run, stage, []);
  return { ...scene, lines: [...after, ...scene.lines] };
}

/** After the bonus round: the hero's thoughts at the halfway mark, then on to the next opponent. */
export const afterBonusScene = (run: Run, stage: number): Scene =>
  meeting(run, stage, [narrate("The scarecrow is in pieces. There is hay everywhere. Two fights down, three to go."), ...arc(run.p1).halfway.map((text) => ({ who: run.p1, text }))]);

/** After a chapter is won on its own: the beaten opponent's last words, and the hero's answer. */
export const aftermathScene = (run: Run, stage: number, beaten: string): Scene => ({ left: run.p1, right: beaten, stage, lines: aftermath({ ...run, rung: run.rung + 1 }, beaten) });

/** After the last fight is won: the one at the top gives way, the narrator closes the story, and the hero has the last word. */
export function finale(run: Run, stage: number): Scene {
  const me = run.p1;
  const top = run.ladder[run.ladder.length - 1];
  const lines: Line[] =
    top === BOSS
      ? [
          { who: BOSS, text: "Well.", mood: "hurt" },
          { who: BOSS, text: "About time somebody did that.", mood: "hurt" },
          { who: BOSS, text: "Go on, then. The roost is yours to rule. Mind the weathervane." },
        ]
      : arc(top).beatenAsRival.map((text): Line => ({ who: top, text, mood: "hurt" }));
  // Through the epilogue, whoever won is pleased with themselves.
  lines.push(...arc(me).epilogue.map((text) => narrate(text, { mood: "happy" })), { who: me, text: arc(me).last, mood: "happy" });
  return { left: me, right: top, stage, lines };
}

/** A fighter's ending on its own, for watching again once it has been earned. */
export function ending(fighter: string, stage: number): Scene {
  const top = fighter === BOSS ? "duke" : BOSS;
  return finale({ p1: fighter, ladder: ["", "", "", "", top], rung: 4, level: 1, score: 0, bonus: false }, stage);
}

// Names, without pulling the roster in: every id is its name with a capital, apart from Old Spur.
function name(id: string) {
  return id === BOSS ? "Old Spur" : id.charAt(0).toUpperCase() + id.slice(1);
}

/** A rival fight in story mode plays by a rule of its own, tied to what the two are arguing about. */
export interface Twist {
  label: string;
  rules: Partial<Rules>;
  /** A narrower space than usual, where the twist calls for one. */
  maxSep?: number;
}

const TWISTS: Record<string, Twist> = {
  "rusty+ziggy": { label: "Sunrise set: 40-second rounds", rules: { seconds: 40 } },
  "dot+henrietta": { label: "By the book: no throws", rules: { noThrows: true } },
  "goldie+shelly": { label: "Warm start: both crow meters begin full", rules: { startMeter: 100 } },
  "duke+pip": { label: "Tight squeeze: nowhere to back away to", rules: {}, maxSep: 250 },
  "henrietta+pepper": { label: "Flash in the pan: one round settles it", rules: { rounds: 1 } },
};

/** The twist on the fight at the run's current rung, if it is a story rival fight. */
export function twistFor(run: Run): Twist | null {
  const rival = run.story ? rivalAt(run) : null;
  return rival ? TWISTS[[run.p1, rival].sort().join("+")] ?? null : null;
}

/** After losing a story fight: the winner crows about it, the hero takes it badly, and the narrator sends them back up. */
export function defeat(run: Run, stage: number): Scene {
  const me = run.p1;
  const them = run.ladder[run.rung];
  const gloat = arc(them).victory[run.rung % 3];
  return {
    left: me,
    right: them,
    stage,
    lines: [
      { who: them, text: gloat, mood: "happy" },
      { who: me, text: arc(me).beaten[0], mood: "hurt" },
      narrate(them === BOSS ? "Old Spur is still on his roof. The ladder is still there. So are you." : "Knocked back down a rung. Dust off your feathers and climb again."),
    ],
  };
}
