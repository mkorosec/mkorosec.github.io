import openai
import os
import datetime
import random

def write_output_to_file(content, content_full_js):
    #file name should contain today's date
    filename = 'output-' + datetime.datetime.now().strftime("%Y-%m-%d") + '.json'
    with open(filename, 'w') as f:
        f.write(content)
    with open("../daily-questions.js", 'w') as f:
        f.write(content_full_js)

def generate_full_json_file(questions):
    prefix = """
if (window.quizList == undefined || window.quizList == null) {
    window.quizList = [];
}

window.quizList.push(
    {
        "name": "The Daily Map Quiz",
        "id": "daily",
        "order": "strict",
        "questions": [
"""            
    suffix = """
        ]
    }
);
"""
    #from questions, strip anything up to the first [ and anything after the first ]
    questions = questions[questions.find("[") + 1:questions.find("]")]
    return prefix + questions + suffix

def main():
    openai.api_key = os.getenv("OPENAI_API_KEY")
    
    prompt = '''
Generate five questions for a daily map game. Use the seed number to uniquely determine the following variables for today's questions:
- **Category**: Pick one from [UNESCO sites, modern architectural marvels, historical battle sites, famous museums, ancient ruins, space exploration sites, dark tourism sites, capital city, world wonder].

Rules:
1. Answers must be specific, mappable locations (cities, buildings, monuments). Never countries, rivers, or regions.
2. Question must un-ambigiously tie to the answer. There should be a clear answer to the question.
3. For coordinates, ensure precision (at least 2 decimal places).
4. Use the seed to deterministically vary categories/themes/facts. 
5. Do not repeat locations in either questions or answers.
6. In the question: Include at least one historical fact, include at least one fact for the popular masses, to make recognizing the location easier. 
7. Do not reveal the location in the question, do not mention the city. You can mention the country, region or continent.

Remember - the main challenge is finding the location on the map, do make the question easy.

Format output as JSON without markdown. Example for seed=42:
{
  "questions": [
    {
      "question": "What is the northernmost UNESCO World Heritage Site, designated for its Viking-age settlements?",
      "answer": { "label": "Ilulissat Icefjord, Greenland", "lat": 69.22, "lng": -49.83 },
      "context": "This fjord's ice sheet provides critical data about climate change and was inhabited by Norse settlers circa 985 AD."
    }
  ]
}    

The JSON you output must have valid syntax. Do not prefix the text with anything, do not note that the format is json, just start with code and end with code.
'''

    # append random number to variable prompt to make it unique
    prompt = prompt + "\nseed: " + str(random.randint(1, 10000000000))

    response = openai.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": prompt,
            }
        ],
        model="gpt-4o",
    )

    text_output = response.choices[0].message.content
    text_output_full_js = generate_full_json_file(text_output)
    print(text_output_full_js)
    write_output_to_file(text_output, text_output_full_js)

if __name__ == "__main__":
    main()