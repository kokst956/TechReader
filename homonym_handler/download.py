import wikipediaapi
WIKI = wikipediaapi.Wikipedia('201803851@o.cnu.ac.kr','ko')

print(WIKI.page('word2vec').summary)