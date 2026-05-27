import fitz

doc = fitz.open("tmp/ESUN_Estatement_11504_removed.pdf")
page = doc[0]
xobjects = page.get_xobjects()
print("XObjects on page 1:")
for xo in xobjects:
    print(xo)

