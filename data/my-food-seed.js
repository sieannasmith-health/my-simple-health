/* My Food prototype seed — derived from the supplied master ingredient inventory. */
(function (root) {
  'use strict';
  const groups = {
    'Baking':['all-purpose flour','baking powder','baking soda','barley grass','bourbon vanilla extract','bread flour','cacao powder','cornstarch','dark brown sugar','dark chocolate chips','gelatin','granulated cane sugar','light brown sugar','Madagascar vanilla extract','matcha powder','powdered sugar','semi-sweet chocolate chips','stevia','vanilla extract','white chocolate chips','yeast'],
    'Cheeses':['blue cheese','burrata','cottage cheese','cream cheese','feta cheese','goat cheese','gorgonzola','Gouda cheese','mozzarella','parmesan','ricotta cheese','white cheddar','yellow cheddar'],
    'Condiments':['artichoke hearts','bonito flakes','capers','Follow Your Heart mayonnaise','giardiniera','Kalamata olives','kombu','pickles','relish','roasted red peppers'],
    'Seafood':['crab','lobster','shrimp','barramundi','catfish','cod','pollock','salmon','tilapia','tuna'],
    'Fruits':['apples','avocado','bananas','blackberries','blueberries','Campari tomatoes','cantaloupe','cherry tomatoes','dried cranberries','grapes','honey dew','lemon','lime','mango','oranges','pineapple','raisins','raspberries','strawberries','tomatoes'],
    'Herbs':['basil','curly parsley','cilantro or coriander leaves','fresh rosemary','fresh thyme','Italian parsley','Thai basil'],
    'Legumes':['black beans','chickpeas','edamame','Great Northern beans','lentils','navy beans','red kidney beans','sweet peas'],
    'Proteins':['chicken breast','chicken sausage','chicken thighs','chuck roast','eggs','filet mignon','flank steak','ground beef','ground chicken','ground pork','ground turkey','Italian sausage','pork bacon','porterhouse','prosciutto','ribeye','turkey bacon'],
    'Dairy & alternatives':['almond milk','butter','coconut milk','Greek yogurt','half and half','heavy cream','oat milk','whole milk'],
    'Grains & starches':['quinoa','brioche bread','brown rice','corn tortilla shells','golden potatoes','Japanese sweet potatoes','oatmeal','penne','potatoes','red potatoes','risotto','rotini','sourdough bread','spaghetti pasta','sweet potatoes','Thai wheat noodles','wheat bread','white potatoes','white rice','wild rice'],
    'Nuts & seeds':['cashew butter','chia seeds','flax seeds','hemp seeds','peanut butter','pecans','pine nuts','pumpkin seeds','raw almonds','sunflower seeds','walnuts'],
    'Oils':['avocado oil','beef tallow','ghee','olive oil','sesame oil or toasted sesame oil','truffle oil'],
    'Plant alternatives':['tofu','Follow Your Heart mayo'],
    'Sauces':['coconut aminos','dark soy sauce','Dijon mustard','fish sauce','green curry paste','hoisin sauce','horseradish','light soy sauce','mirin','miso paste (red)','miso paste (white)','oyster sauce','red curry paste','sriracha','tamarind paste','Worcestershire sauce','yellow curry paste'],
    'Seasonings':['21 seasoning salute','aglio olio blend','allspice','basil','bay leaves','beef bouillon','black pepper','blackened seasoning','cayenne pepper','celery seed','chicken bouillon','chili powder (six chili blend)','cilantro (dried)','coriander powder','coriander seed','cumin powder','cumin seed','everything but the bagel','fennel seed','granulated garlic','green goddess','ground cinnamon','ground ginger','iodized salt','Italian seasoning','Jamaican jerk seasoning','marjoram','mushroom & umami','mustard seed','nutmeg','onion powder','oregano','peppercorn','pumpkin pie spice','ranch seasoning','rosemary','salmon rub','sazon','smoked paprika','smoky & hot chile powder','thyme','truffle salt','turmeric'],
    'Vegetables':['arugula','Baby Bella mushrooms','bean sprouts','bell pepper','bok choy','broccoli','broccolini','Brussels sprouts','carrots','cauliflower','celery','chilies','cucumber','eggplant','endives','garlic','green beans','green cabbage','green onions','jalapeños','kale','leeks','lemongrass','lettuce','microgreens','onion','Portobello mushrooms','purple cabbage','radicchio','radish','red onion','shallots','Shiitake mushrooms','spinach','spring mix','sweet onion','white onion','yellow onion','yellow squash','zucchini'],
    'Vinegars':['apple cider vinegar','balsamic vinegar','rice vinegar','red wine vinegar','sherry','white vinegar']
  };
  root.MSHFoodSeed = Object.freeze(Object.entries(groups).flatMap(([category, names]) => names.map((name, index) => ({ id:`seed_${category.toLowerCase().replace(/[^a-z0-9]+/g,'_')}_${index+1}`, name, category }))));
})(typeof window !== 'undefined' ? window : globalThis);
