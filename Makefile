.PHONY: doc

all: doc 

doc:
	@esdoc -c esdoc.json 

clean:
	rm -rf doc/
