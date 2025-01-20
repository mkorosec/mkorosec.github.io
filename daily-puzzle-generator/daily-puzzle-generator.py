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
Generate three questions for a daily map game. The questions should be unique each time, in order to achieve this, a seed number is provided at the end.
The answer should be an exact location, like a city, museum, or similar. Do not ask about countries, rivers, regions or anything that might require an amgiuous answer. 
The answer should be a specific location that can be found on a map. 
The context should be a short sentence or two that provides some information about the location.

Use difficulty: easy. The format is JSON, this is the exact format I want you to generate:
{
    questions: [
            {
                "question": "Which city is home to the world's first dedicated oil refinery, established in 1856?",
                "answer": { "label": "Ploiești, Romania", "lat": 44.94, "lng": 26.03 },
                "context": "Ploiești is famously known as a pioneering city for oil refining, with innovations in refining processes beginning there in the 19th century."
            }
    ]
}

The JSON you output must have valid syntax. Do not prefix the text with anything, do not note that the format is json, just start with code and end with code.
'''

    # append random number to variable prompt to make it unique
    prompt = prompt + "\nseed: " + str(random.randint(1000000, 10000000000))

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