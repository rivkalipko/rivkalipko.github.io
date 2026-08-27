// Copyedits are kept separate from the immutable WordPress export. The build
// validates every replacement, so stale or mistyped edits fail loudly.
// Every published article is listed here, including articles that needed no
// textual correction after review.
export const ARTICLE_EDITS = [
  { slug: "the-touche-stats-data-is-now-public", replacements: [] },
  { slug: "when-voter-id-laws-decrease-turnout-and-when-they-dont", replacements: [] },
  { slug: "why-i-love-anki-10k-reviews-and-100-days-later", replacements: [
    [`I was excited that I&#8217;d the opportunity`, `I was excited that I had the opportunity`],
    [`an enormous amounts of time`, `an enormous amount of time`],
    [`I scored relatively without any preparation`, `I scored relatively well without any preparation`]
  ] },
  { slug: "edging-out-latin-bert-at-text-infilling-with-fine-tuned-gpt-4o", replacements: [
    [`Latin bert: A contextual language model`, `Latin BERT: A contextual language model`]
  ] },
  { slug: "90-of-youth-fencers-want-to-practice-more-footwork", replacements: [
    [`Saber fencers were the most satisfied by their referees`, `Saber fencers were the most satisfied with their referees`]
  ] },
  { slug: "a-statistical-stab-at-referee-bias", replacements: [
    [`has been moored with controversy`, `has been mired in controversy`],
    [`ln(P(win)/P(loss))`, String.raw`\(\ln\!\left(\frac{P(\text{win})}{P(\text{loss})}\right)\)`],
    [`familiarity bias in soccer in baseball`, `familiarity bias in soccer and baseball`],
    [`Twelve eyes see more than eight. referee Bias`, `Twelve eyes see more than eight: Referee bias`]
  ] },
  { slug: "joining-a-top-club-wont-necessarily-make-you-better", replacements: [
    [`the performance gains are nominal at best`, `the performance gains are minimal at best`],
    [`fencers who change club and move divisions`, `fencers who change clubs and move divisions`],
    [`a one point difference in indicator`, `a one-point difference in indicator`],
    [`estimators for Causal inference`, `estimators for causal inference`]
  ] },
  { slug: "can-fencers-bounce-back-from-being-cut-after-pools-pt-2", replacements: [
    [`from percentile in event to indicator`, `from event percentile to indicator`],
    [`change in number of points scored was`, `change in indicator points was`],
    [`the Minimum Detectable Effect (MDE)`, `the minimum detectable effect (MDE)`],
    [`effects larger than 3 points in indicator`, `effects larger than three indicator points`]
  ] },
  { slug: "can-fencers-bounce-back-from-being-cut-after-pools", replacements: [
    [`Significance level: <em>α</em> = 0.05`, String.raw`Significance level: \(\alpha = 0.05\)`],
    [`placing about 25 percentile higher`, `placing about 25 percentile points higher`],
    [`performance in their next event</p>`, `performance in their next event.</p>`],
    [`a tiny increase of 1.2 percentile`, `a tiny increase of 1.2 percentile points`],
    [`with a <em>p</em>-value of 0.680`, String.raw`with \(p = 0.680\)`],
    [`2.1 percentile, <em>p</em>-value = 0.481`, String.raw`2.1 percentile points, \(p = 0.481\)`],
    [`0.4 percentile, <em>p</em>-value = 0.996`, String.raw`0.4 percentile points, \(p = 0.996\)`],
    [`5.9 percentile, <em>p</em>-value = 0.164`, String.raw`5.9 percentile points, \(p = 0.164\)`],
    [`-1.1 percentile, <em>p</em>-value = 0.860`, String.raw`-1.1 percentile points, \(p = 0.860\)`],
    [`-1.5 percentile, <em>p</em>-value = 0.597`, String.raw`-1.5 percentile points, \(p = 0.597\)`],
    [`Therefore there is <strong>no evidence`, `Therefore, there is <strong>no evidence`]
  ] },
  { slug: "statistical-significance-might-be-less-significant-in-the-future", replacements: [
    [`Nowadays people (usually)`, `Nowadays, people (usually)`],
    [`(>50% chance of heads)`, String.raw`with \(P(\text{heads}) > 0.5\)`],
    [`the<em> p</em>-value for 9 heads out of 10 flips is about 1% (or 0.01)`, String.raw`the result for 9 heads out of 10 flips is \(p \approx 0.01\)`]
  ] },
  { slug: "surprise-east-coast-nacs-do-not-harm-performance", replacements: [
    [`randomized control trials (RCTs)`, `randomized controlled trials (RCTs)`],
    [`since there are a larger sample of pool bouts`, `since there is a larger sample of pool bouts`],
    [`our regression formulas is`, `our regression formula is`],
    [`(<em>West Coast fencer score </em>&#8211;<em> East Coast fencer score</em>) = intercept + <em>α</em>·(<em>number of fencers in event</em>) + <em><em>β</em></em>·(<em>early start time</em>)`, String.raw`\[\text{West Coast score} - \text{East Coast score} = \text{intercept} + \alpha(\text{event size}) + \beta(\text{early start})\]`],
    [`Where our variable of interest is <em><em>β</em></em>, the effect of the early start time.`, String.raw`Here, \(\beta\) is the variable of interest: the effect of the early start time.`],
    [`(-0.332 0.218)`, `(-0.332, 0.218)`],
    [`clustering?.`, `clustering?`]
  ] },
  { slug: "at-what-age-do-fencers-make-the-most-improvement", replacements: [
    [`each fencers’ TrueSkill ratings`, `each fencer’s TrueSkill ratings`],
    [`as they more from Cadet into Junior`, `as they move from Cadet into Junior`],
    [`Since boys have puberty about one year later than girls`, `Since boys enter puberty about one year later than girls`]
  ] },
  { slug: "synthetic-controls-a-powerful-way-to-measure-policy-impact", replacements: [
    [`the name-change caused`, `the name change caused`],
    [`modeled the counterfactual; what would have happened`, `modeled the counterfactual: what would have happened`],
    [`you can never establish a cause-and-effect relationship, you can only find associations`, `you can never establish a cause-and-effect relationship; you can only find associations`],
    [`the broader fields of econometrics and causal inference`, `the broader field of econometrics and causal inference`],
    [`It&#8217;s fascinating we can use these methods`, `It&#8217;s fascinating that we can use these methods`],
    [`the &#8220;gold-standard&#8221;`, `the &#8220;gold standard&#8221;`],
    [`{<em>x</em><sub>1</sub>, <em>x</em><sub>2</sub>, &#8230; <em>x</em><sub><em>n</em></sub>}`, String.raw`\(\{x_1, x_2, \ldots, x_n\}\)`],
    [`{<em>w</em><sub>1</sub>, <em>w</em><sub>2</sub>, &#8230; <em>w</em><sub><em>n</em></sub>}`, String.raw`\(\{w_1, w_2, \ldots, w_n\}\)`],
    [`<em>w</em><sub>1</sub><em>x</em><sub>1</sub> + <em>w</em><sub>2</sub><em>x</em><sub>2</sub>+ &#8230; + <em>w</em><sub><em>n</em></sub><em>x</em><sub><em>n</em></sub>`, String.raw`\(\sum_{i=1}^{n} w_i x_i\)`],
    [`illustrates how weighing the units`, `illustrates how weighting the units`],
    [`mean square prediction error`, `mean squared prediction error`],
    [`mean square prediction error`, `mean squared prediction error`]
  ] },
  { slug: "do-some-regions-have-inflated-ratings", replacements: [
    [`win/loss and score difference depends`, `win/loss and score difference depend`],
    [`A Region 6 fencer would on average, be`, `A Region 6 fencer would, on average, be`],
    [`Within each weapon there were`, `Within each weapon, there were`],
    [`Additionally this proves`, `Additionally, this shows`],
    [`a similarly skilled Region 1 fencer</strong>`, `a similarly skilled Region 1 fencer.</strong>`]
  ] },
  { slug: "what-is-the-best-way-to-get-national-points", replacements: [
    [`lower ranked competitors`, `lower-ranked competitors`],
    [`(eg. Y-10`, `(e.g., Y-10`],
    [`to award points to award points`, `to award points`],
    [`a single digit number of points`, `a single-digit number of points`]
  ] },
  { slug: "how-are-pools-correlated-with-performance", replacements: [
    [`struck my curiosity`, `piqued my curiosity`],
    [`For example the fencer`, `For example, the fencer`],
    [`and the red representing fencers`, `and red representing fencers`],
    [`The correlation in this graph was&nbsp;0.916, which means that pool results and final placing is very well correlated. This means that 83% of the final results can be explained by the pool results.`, String.raw`The correlation in this graph was \(r = 0.916\), which means that pool results and final placing are strongly correlated. In this sample, \(R^2 \approx 0.84\), so about 84% of the variation in final results can be explained by pool results.`],
    [`a high seeded fencer`, `a high-seeded fencer`],
    [`the placement in end`, `the placement in the end`],
    [`there&#8217;s also more upsets in epee`, `there are also more upsets in epee`],
    [`<em>Overall result</em> = <em>Fencing skill that day</em> + <em>Matchups at tournament</em> + <em>Luck</em>`, String.raw`\[\text{Overall result} = \text{fencing skill that day} + \text{matchups} + \text{luck}\]`],
    [`<em>Overall result</em> = <em>Fencing skill that day</em> + <em>Pool placement</em> + <em>Luck</em>`, String.raw`\[\text{Overall result} = \text{fencing skill that day} + \text{pool placement} + \text{luck}\]`],
    [`sets up you for an easy path`, `sets you up for an easy path`]
  ] },
  { slug: "are-lower-rated-referees-associated-with-more-upsets", replacements: [
    [`a higher rated referee`, `a higher-rated referee`],
    [`a lower rated one`, `a lower-rated one`],
    [`lower rated referees`, `lower-rated referees`],
    [`tip the scale towards`, `tip the scales toward`],
    [`a scale from 1-10`, `a scale from 1–10`],
    [`high level international referees`, `high-level international referees`],
    [`the lower seeded fencer`, `the lower-seeded fencer`],
    [`For each referees who had officiated`, `For each referee who had officiated`],
    [`results for variance of individual referees`, `evidence of differences in variance among individual referees`],
    [`specific bias for or against a fencer`, `specific bias toward or against a fencer`]
  ] },
  { slug: "are-a-rated-fencers-more-consistent", replacements: [
    [`national tournaments bouts`, `national tournament bouts`],
    [`a 5 touch bout`, `a 5-touch bout`],
    [`an A and B rated fencer`, `an A- and B-rated fencer`],
    [`dots outside the min/max`, `dots outside the whiskers`],
    [`scores to fall to far out`, `scores to fall too far outside`],
    [`B-rated fencers, show`, `B-rated fencers show`],
    [`lower rated fencers`, `lower-rated fencers`],
    [`A rated fencers`, `A-rated fencers`],
    [`a similar, and consistent amount`, `a similar and consistent amount`]
  ] },
  { slug: "uneven-pool-sizes-are-unfair", replacements: [
    [`every one does &#8220;as expected&#8221;`, `everyone does &#8220;as expected&#8221;`],
    [`higher seeded fencers`, `higher-seeded fencers`],
    [`Notice that how even though`, `Notice that even though`],
    [`with an event with only 20 people`, `in an event with only 20 people`],
    [`the real world data show`, `the real-world data show`],
    [`for a tournament with <em>N</em> people a fencer will place 0.04<em>N </em>lower`, String.raw`for a tournament with \(N\) people, a fencer will place \(0.04N\) places lower`],
    [`since those numbers only divide 1 and themselves`, `since those numbers are divisible only by 1 and themselves`]
  ] },
  { slug: "why-fencing-is-often-so-disappointing-12-of-bouts-are-lost-by-one-point", replacements: [
    [`a score of 15-14`, `a score of 15–14`],
    [`decided by only a one or two touches`, `decided by only one or two touches`],
    [`The weapon specific trends`, `The weapon-specific trends`],
    [`so probably the score remains tight`, `so the score probably remains tight`],
    [`15 touch bouts`, `15-touch bouts`],
    [`5 touch bouts`, `5-touch bouts`]
  ] },
  { slug: "do-past-performances-predict-future-results", replacements: [
    [`This is a question of many fencers`, `This is a question for many fencers`],
    [`Of course you wish`, `Of course, you wish`],
    [`skill levels at fencers`, `skill levels of fencers`],
    [`Methodology is identical to`, `The methodology is identical to`],
    [`As a reminder here is`, `As a reminder, here is`],
    [`except in mens&#8217; fencing`, `except in men&#8217;s fencing`],
    [`(long term)`, `(long-term)`],
    [`I did linear regression which basically makes a y=mx+b line`, String.raw`I ran a linear regression, which fits a \(y = mx + b\) line`]
  ] },
  { slug: "y12-performance-predicts-cadet-performance-surprisingly-well", replacements: [
    [`over a large period of time`, `over a long period of time`],
    [`between the seeding of fencers between their second year of Y12 and their first year of Cadet`, `between fencers&#8217; seedings in their second year of Y12 and their first year of Cadet`],
    [`a moderate-strong predictive`, `a moderately strong predictive`]
  ] },
  { slug: "is-epee-easier-than-foil", replacements: [
    [`Like they think that foil fencers`, `They think that foil fencers`],
    [`(eg. March NAC 2019)`, `(e.g., March NAC 2019)`],
    [`in their non-preferred may be`, `in their non-preferred weapon may be`],
    [`with an foil rating`, `with a foil rating`],
    [`more transferrable to epee`, `more transferable to epee`],
    [`more transferrable to epee`, `more transferable to epee`],
    [`This is just mere speculation`, `This is just speculation`],
    [`do not know right of way`, `do not know right-of-way`],
    [`a 0.06% chance of earning a rating in foil`, `a 0.6% chance of earning a rating in foil`],
    [`which never happens in epee.`, `which did not happen for epee fencers competing in foil.`]
  ] },
  { slug: "when-can-youth-and-cadet-fencers-make-a-breakthrough", replacements: [
    [`when fencers get puberty`, `when fencers go through puberty`],
    [`the #1fencer was #1`, `the #1 fencer was #1`],
    [`the next year, etc,`, `the next year, etc.,`]
  ] },
  { slug: "how-often-do-low-rated-fencers-get-to-the-later-rounds", replacements: [
    [`got into top 64`, `got into the top 64`],
    [`also includes those in the top 32`, `also include those in the top 32`],
    [`How often do lower fencers make it far?`, `How often do lower-rated fencers make it far?`],
    [`D and below rated fencers`, `D-and-below-rated fencers`],
    [`How often can lower rated fencers get points?`, `How often can lower-rated fencers get points?`],
    [`in an average tournament the top 64`, `in an average tournament, the top 64`]
  ] },
  { slug: "unveiling-fencings-winning-odds-by-rating", replacements: [
    [`but at the same time people`, `but at the same time, people`],
    [`the same A4 rating of a local tournament`, `the same A4 rating as a local tournament`],
    [`the skill level of the people that earn As are very different`, `the skill levels of the people who earn As are very different`],
    [`the rating one below`, `the rating below it`],
    [`15 touch bouts`, `15-touch bouts`],
    [`1-7% more likely`, `1–7% more likely`],
    [`1-6% less likely`, `1–6% less likely`]
  ] },
  { slug: "regeneron-sts-finals-week-day-7", replacements: [
    [`departed to the airport with my parents`, `departed for the airport with my parents`],
    [`Because the goal of Finals Week is to inspire us, through`, `The goal of Finals Week is to inspire us through`]
  ] },
  { slug: "regeneron-sts-finals-week-day-6", replacements: [
    [`a few other pictures with fewer people in it`, `a few other pictures with fewer people in them`],
    [`He was in fact important`, `He was, in fact, important`],
    [`important to have an exit plan, otherwise,`, `important to have an exit plan; otherwise,`],
    [`playing Crazy Eight`, `playing Crazy Eights`],
    [`the most interesting things he said are that`, `the most interesting things he said were:`],
    [`other companies can fund your own in exchange`, `other companies can fund your company in exchange`],
    [`Getting an MD and PhD`, `Getting an MD and a PhD`],
    [`besides Pubic Day`, `besides Public Day`]
  ] },
  { slug: "regeneron-sts-finals-week-day-5", replacements: [
    [`the massive windows everywhere which let in`, `the massive windows everywhere that let in`],
    [`a 10 million-dollar microscope`, `a $10 million microscope`],
    [`a structure in their brain`, `a structure in their brains`],
    [`I overall found the research`, `Overall, I found the research`],
    [`forces the T-cells to kill`, `forces the T cells to kill`]
  ] },
  { slug: "regeneron-sts-finals-week-day-4", replacements: [
    [`the subject we were experts in`, `the subjects in which we were experts`],
    [`pop in at random times to our posters`, `pop in at random times at our posters`],
    [`thinking deeper about my project`, `thinking more deeply about my project`],
    [`chance of getting top 10`, `chance of placing in the top 10`],
    [`tired of standing on my feet`, `tired of standing`],
    [`When Public Day was done`, `When Public Day was over`],
    [`until 5 pm when we would learn`, `until 5 p.m., when we would learn`],
    [`like the Lincoln, Martin Luther King Jr., and World War II Memorial`, `like the Lincoln, Martin Luther King Jr., and World War II memorials`]
  ] },
  { slug: "regeneron-sts-finals-week-day-3", replacements: [
    [`it&#8217;s daylight savings tomorrow`, `daylight saving time begins tomorrow`],
    [`a 500-1,000 blog post`, `a 500–1,000-word blog post`],
    [`I slept the best I had in days`, `I slept better than I had in days`],
    [`we decided who were going to nominate`, `we decided whom we were going to nominate`],
    [`Akilan was decided to be the speaker`, `Akilan was selected as the speaker`],
    [`On the walk there I talked`, `On the walk there, I talked`],
    [`ran a mile then went back`, `ran a mile, then went back`]
  ] },
  { slug: "regeneron-sts-finals-week-day-2", replacements: [
    [`for many of them, there was no right answer, or we all answered partially correctly, but altogether we had enough knowledge to fully answer it`, `for many of them, there was no single right answer; we each answered partially correctly, but together we had enough knowledge to answer fully`],
    [`a special Alumni dinner`, `a special alumni dinner`],
    [`After he had finished asking questions`, `After he had finished answering questions`],
    [`BWS is not which makes it significantly more complex to treat, in fact, there is still no treatment today`, `BWS is not, which makes it significantly more complex to treat; in fact, there is still no treatment today`],
    [`I needed to get to bed, and I also wrote this blog post`, `I needed to get to bed, so I wrote this blog post`]
  ] },
  { slug: "regeneron-sts-finals-week-day-1", replacements: [
    [`I must record the video sooner`, `I had to record the video sooner`],
    [`I spoke better than I was when I was practicing`, `I spoke better than I had in practice`],
    [`the last would be the best because had the most practice`, `the last would be the best because I had the most practice`],
    [`selecting the second for use on the website`, `selecting the second take for use on the website`],
    [`tasks that I manually did in Photoshop`, `tasks that I performed manually in Photoshop`],
    [`but halfway through realized`, `but halfway through, I realized`],
    [`the tomato pie which was so sweet`, `the tomato pie, which was so sweet`],
    [`top 10 spots we are still all winners`, `top 10 spots, we are still all winners`],
    [`find the finalist that matched the fun fact square`, `find the finalist who matched each fun-fact square`],
    [`to get some rest, where I wrote this blog post`, `to get some rest, then wrote this blog post`]
  ] },
  { slug: "regeneron-sts-finals-week-day-0", replacements: [
    [`I woke up at 6:30 am this morning so I would have enough time to get to the airport this morning`, `I woke up at 6:30 a.m. so I would have enough time to get to the airport`],
    [`The flight was overall fairly mundane`, `Overall, the flight was fairly mundane`],
    [`went down the elevator to meet`, `took the elevator down to meet`],
    [`ranking which values were most important to us: money, fame, impact, and fun, to talking`, `ranking which values—money, fame, impact, and fun—were most important to us, to talking`],
    [`talking about AI safety which spiraled`, `talking about AI safety, which spiraled`],
    [`other rooms that the event would be happening in`, `other rooms where the event would take place`],
    [`would look even more scary`, `would look even scarier`]
  ] }
];

export const GLOSSARY_EDITS = [];
